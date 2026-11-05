import test, { before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.SMTP_HOST = 'smtp.test.invalid';
process.env.FROM_EMAIL = 'phase3@eventra.test';
process.env.STRIPE_SECRET_KEY = 'sk_test_' + crypto.randomBytes(16).toString('hex');
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_' + crypto.randomBytes(16).toString('hex');
delete process.env.SMTP_USER; delete process.env.SMTP_PASS;
const { default: User } = await import('../models/User.js');
const { default: Event } = await import('../models/event.js');
const { default: Booking } = await import('../models/booking.js');
const { default: Notification } = await import('../models/Notification.js');
const { default: Complaint } = await import('../models/complaints.js');
const { default: authRoutes } = await import('../routes/authRoutes.js');
const { default: eventRoutes } = await import('../routes/eventRoutes.js');
const { default: adminRoutes } = await import('../routes/adminRoutes.js');
const { default: bookingRoutes } = await import('../routes/bookingRoutes.js');
const { default: analyticsRoutes } = await import('../routes/analyticsRoutes.js');
const { default: ticketRoutes } = await import('../routes/ticketRoutes.js');
const { generateToken } = await import('../utils/authTokens.js');
const { notifyBooking, deliverNotifications } = await import('../services/notificationService.js');
const { profileFields, literalSearch, pageQuery } = await import('../utils/phase3Validation.js');
const app = express(); app.use(express.json({ limit: '10mb' }));
for (const [path, router] of [['auth',authRoutes],['events',eventRoutes],['admin',adminRoutes],['bookings',bookingRoutes],['analytics',analyticsRoutes],['tickets',ticketRoutes]]) app.use('/api/' + path,router);
let server, base, customer, other, organizer, foreign, admin, event, mail, failMail;
const prefix = 'eventra_phase3_test_' + process.pid + '_' + crypto.randomBytes(4).toString('hex');
let serial = 0;
const uri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017';
before(async () => {
  if (!/^mongodb:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|\?|$)/.test(uri)) throw Error('Tests require loopback MongoDB.');
  mock.method(nodemailer, 'createTransport', () => ({ async sendMail(message) { if (failMail) throw Error('SMTP unavailable'); mail.push(message); return { accepted:[message.to] }; } }));
  server = app.listen(0,'127.0.0.1'); await new Promise((resolve) => server.once('listening',resolve));
  base = 'http://127.0.0.1:' + server.address().port;
});
beforeEach(async () => {
  await mongoose.disconnect(); await mongoose.connect(uri,{ dbName: prefix + '_case' + (++serial), serverSelectionTimeoutMS: 4000 });
  await Promise.all([User.createIndexes(), Event.createIndexes(), Booking.createIndexes(), Notification.createIndexes()]);
  mail=[];failMail=false;
  const makeUser = (role,name) => User.create({ name, email:name+'@eventra.test',password:'Audit-Password9!',role,isVerified:true,subscriptionPlan:'pro' });
  [customer,other,organizer,foreign,admin] = await Promise.all([makeUser('customer','customer'),makeUser('customer','other'),makeUser('organizer','organizer'),makeUser('organizer','foreign'),makeUser('superadmin','admin')]);
  const start = new Date(Date.now()+86400000), end = new Date(+start+3600000);
  event=await Event.create({tenantId:organizer._id,title:'Emerald Concert',description:'A live concert',category:'Music',startDateTime:start,endDateTime:end,date:start,location:'Colombo',ticketPrice:10,totalCapacity:10,availableTickets:10,approvalStatus:'approved',
    locations:[{name:'Colombo',address:'Main hall',date:start,startDateTime:start,endDateTime:end,ticketTiers:[{name:'General',price:10,totalQuantity:10,availableQuantity:10,soldQuantity:0,reservedQuantity:0}]}]});
});
after(async () => { if(server) await new Promise((resolve)=>server.close(resolve));await mongoose.disconnect();mock.restoreAll(); });
const request = async (path,user,method='GET',body) => {
  const response = await fetch(base+'/api'+path,{method,headers:{...(user?{authorization:'Bearer '+generateToken(user)}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const raw = await response.text();
  return {status:response.status,data:response.headers.get('content-type')?.includes('application/json') ? JSON.parse(raw) : raw};
};
const booking = (extra={}) => Booking.create({bookingId:'BKG-'+crypto.randomUUID(),eventId:event._id,tenantId:organizer._id,customerId:customer._id,locationId:event.locations[0]._id,ticketTierId:event.locations[0].ticketTiers[0]._id,
 ticketQuantity:2,ticketType:'General',unitPrice:10,totalAmount:21,platformFee:1,organizerRevenue:20,paymentVersion:2,paymentVerifiedAt:new Date(),paymentStatus:'paid',bookingStatus:'CONFIRMED',ticketStatus:'VALID',qrToken:'TKT-'+crypto.randomBytes(32).toString('hex'),qrCodeString:'TKT-'+crypto.randomBytes(32).toString('hex'),locationStartDateTime:event.startDateTime,locationEndDateTime:event.endDateTime,...extra});
const editable = () => ({title:event.title,description:event.description,category:event.category,bannerUrl:'',locations:event.locations.toObject().map((loc)=>({...loc,startDateTime:loc.startDateTime.toISOString(),endDateTime:loc.endDateTime.toISOString()}))});
test('validation rejects protected profile fields, structured search and invalid pagination',()=>{
 assert.throws(()=>profileFields({role:'superadmin'}));assert.throws(()=>profileFields({email:'new@test.invalid'}));assert.throws(()=>pageQuery({page:'0'}));assert.throws(()=>literalSearch({$ne:''}));assert.equal(literalSearch('a.*'),'a\\.\\*');
});
test('profile updates allow only names and contact details and preserve session',async()=>{
 const token=generateToken(customer);
 const response=await request('/auth/profile',customer,'PUT',{name:'Updated Customer',contactNumber:'+94 777 123456'});assert.equal(response.status,200);assert.equal(response.data.name,'Updated Customer');assert.equal(response.data.password,undefined);
 assert.equal((await request('/auth/profile',customer,'PUT',{role:'superadmin'})).status,400);
 const result=await fetch(base+'/api/auth/profile',{headers:{authorization:'Bearer '+token}});assert.equal(result.status,200);
});
test('suspension revokes JWT and reactivation does not revive old sessions',async()=>{
 const token=generateToken(customer);
 assert.equal((await request('/admin/users/'+customer._id+'/status',admin,'PUT',{accountStatus:'suspended'})).status,200);
 assert.equal((await fetch(base+'/api/auth/profile',{headers:{authorization:'Bearer '+token}})).status,401);
 assert.equal((await request('/admin/users/'+customer._id+'/status',admin,'PUT',{accountStatus:'active'})).status,200);
 assert.equal((await fetch(base+'/api/auth/profile',{headers:{authorization:'Bearer '+token}})).status,401);
 assert.equal((await request('/auth/login',null,'POST',{email:customer.email,password:'Audit-Password9!'})).status,200);
});
test('customers cannot manage accounts and all admin access is preserved',async()=>{
 assert.equal((await request('/admin/users/'+other._id+'/status',customer,'PUT',{accountStatus:'suspended'})).status,403);
 assert.equal((await request('/admin/users/'+admin._id+'/status',admin,'PUT',{accountStatus:'suspended'})).status,409);
 assert.equal((await request('/admin/users/'+admin._id+'/role',admin,'PUT',{role:'customer'})).status,409);
 assert.equal((await request('/admin/users/'+customer._id,admin,'DELETE')).status,404);
});
test('user search and role/status filters are applied on the backend',async()=>{
 await User.updateOne({_id:other._id},{$set:{accountStatus:'suspended'}});
 const result=await request('/admin/users?search=other&role=customer&status=suspended',admin);assert.equal(result.status,200);assert.equal(result.data.length,1);assert.equal(result.data[0].name,'other');assert.equal(result.data[0].password,undefined);
});
test('dashboard sales exclude unverified, refund-requested and other-tenant bookings',async()=>{
 await booking();await booking({paymentVerifiedAt:undefined});await booking({refundRequested:true});await booking({tenantId:foreign._id});
 const result=await request('/analytics/organizer',organizer);assert.equal(result.status,200);assert.equal(result.data.summary.totalRevenue,20);assert.equal(result.data.summary.totalTicketsSold,2);assert.equal(result.data.summary.upcoming,1);assert.equal(result.data.summary.availableTickets,10);
 assert.equal(result.data.recentBookings.some((row)=>row.qrToken||row.customerEmail),false);
 const empty=await request('/analytics/organizer',foreign);assert.equal(empty.data.summary.totalRevenue,0);
});
test('admin dashboard uses booking models for verified financial metrics and counts',async()=>{
 await booking();await booking({paymentStatus:'refunded',bookingStatus:'CANCELLED',refundedAmount:21});await booking({paymentVerifiedAt:undefined});
 const result=await request('/analytics/admin',admin);assert.equal(result.status,200);assert.equal(result.data.overview.totalUsers,5);assert.equal(result.data.overview.totalCustomers,2);assert.equal(result.data.financials.totalGrossVolume,21);assert.equal(result.data.financials.totalVerifiedTransactions,2);
 const transactions=await request('/admin/transactions',admin);assert.equal(transactions.data.length,2);assert.ok(transactions.data[0].bookingId);assert.equal(transactions.data[0].customerEmail,undefined);
});
test('event edits preserve identities and requeue approval; other tenants denied',async()=>{
 const payload=editable();payload.description='An updated description';payload.locations[0].ticketTiers[0].totalQuantity=12;
 assert.equal((await request('/events/'+event._id,foreign,'PUT',payload)).status,404);
 const result=await request('/events/'+event._id,organizer,'PUT',payload);assert.equal(result.status,200);assert.equal(result.data.approvalStatus,'pending');assert.equal(result.data.availableTickets,12);assert.equal(result.data.locations[0]._id,String(event.locations[0]._id));
 assert.equal((await request('/events/'+event._id,null)).status,404);
});
test('sold and reserved inventory cannot be overwritten or reduced below occupancy',async()=>{
 await Event.updateOne({_id:event._id},{$set:{'locations.0.ticketTiers.0.soldQuantity':3,'locations.0.ticketTiers.0.reservedQuantity':2,'locations.0.ticketTiers.0.availableQuantity':5,availableTickets:5}});
 event=await Event.findById(event._id);await booking();
 let payload=editable();payload.locations[0].ticketTiers[0].totalQuantity=4;
 assert.equal((await request('/events/'+event._id,organizer,'PUT',payload)).status,409);
 payload=editable();payload.locations[0].ticketTiers[0].price=12;assert.equal((await request('/events/'+event._id,organizer,'PUT',payload)).status,409);
 payload=editable();payload.locations[0].ticketTiers[0].totalQuantity=12;const result=await request('/events/'+event._id,organizer,'PUT',payload);assert.equal(result.status,200);assert.equal(result.data.availableTickets,7);assert.equal(result.data.locations[0].ticketTiers[0].soldQuantity,3);assert.equal(await Booking.countDocuments(),1);
});
test('dates and venues lock after booking activity; completed events reject updates',async()=>{
 await booking();let payload=editable();payload.locations[0].name='Changed venue';assert.equal((await request('/events/'+event._id,organizer,'PUT',payload)).status,409);
 await Event.updateOne({_id:event._id},{$set:{endDateTime:new Date(Date.now()-1000)}});
 assert.equal((await request('/events/'+event._id,organizer,'PUT',{description:'Updated'})).status,409);
});
test('approval and rejection require pending events and a rejection reason',async()=>{
 await Event.updateOne({_id:event._id},{$set:{approvalStatus:'pending'}});
 assert.equal((await request('/admin/events/'+event._id+'/reject',admin,'PUT',{})).status,400);
 assert.equal((await request('/admin/events/'+event._id+'/reject',admin,'PUT',{reason:'Venue evidence is missing'})).status,200);
 assert.equal((await request('/events/'+event._id,null)).status,404);
 await request('/events/'+event._id,organizer,'PUT',{description:'Evidence supplied'});
 assert.equal((await request('/admin/events/'+event._id+'/approve',admin,'PUT',{})).status,200);
 assert.equal(await Notification.countDocuments(),2);
});
test('event cancellation retains paid bookings and hides all customer QR passes',async()=>{
 const paid=await booking();assert.equal((await request('/bookings/'+paid._id,customer)).data.canUseTicket,true);
 assert.equal((await request('/events/'+event._id+'/cancel',organizer,'POST',{reason:'Severe weather conditions'})).status,200);
 const result=await request('/bookings/'+paid._id,customer);assert.equal(result.data.canUseTicket,false);assert.equal(result.data.qrToken,undefined);
 const stored=await Booking.findById(paid._id);assert.equal(stored.paymentStatus,'paid');assert.equal(stored.refundedAmount,0);assert.equal(await Event.countDocuments(),1);
});
test('customer cancellation policy retains paid bookings and protects ownership',async()=>{
 const paid=await booking();assert.equal((await request('/bookings/'+paid._id+'/cancel',other,'POST',{})).status,404);
 assert.equal((await request('/bookings/'+paid._id+'/cancel',customer,'POST',{})).status,409);
});
test('complaints are owned by customer and admin response is visible only to owner',async()=>{
 const result=await request('/bookings/complaints',customer,'POST',{subject:'Ticket assistance',description:'Please help with my booking reference.'});assert.equal(result.status,201);
 assert.equal((await request('/bookings/complaints',other)).data.length,0);
 assert.equal((await request('/admin/complaints/'+result.data._id+'/resolve',admin,'PUT',{response:'We have reviewed your request.'})).status,200);
 const mine=await request('/bookings/complaints',customer);assert.equal(mine.data[0].status,'resolved');assert.ok(mine.data[0].response);
 assert.equal((await request('/admin/complaints',customer)).status,403);assert.equal(await Complaint.countDocuments(),1);
});
test('check-in history is tenant scoped, paginated, and excludes QR/payment data',async()=>{
 await booking({ticketStatus:'USED',isCheckedIn:true,checkedInAt:new Date()});
 const result=await request('/tickets/history?status=used&page=1',organizer);assert.equal(result.status,200);assert.equal(result.data.total,1);assert.ok(result.data.records[0].checkedInAt);assert.equal(result.data.records[0].qrToken,undefined);
 assert.equal((await request('/tickets/history',foreign)).data.total,0);assert.equal((await request('/tickets/history',admin)).data.total,1);assert.equal((await request('/tickets/history',customer)).status,403);
});
test('discovery validates queries and filters category, location, name and approval',async()=>{
 const result=await request('/events?page=1&search=Emerald&category=Music&location=Colombo',null);assert.equal(result.status,200);assert.equal(result.data.total,1);
 assert.equal((await request('/events?page=0',null)).status,400);assert.equal((await request('/events?date=2027-02-30',null)).status,400);assert.equal((await request('/events?status=cancelled',null)).status,400);
 await Event.updateOne({_id:event._id},{$set:{approvalStatus:'rejected'}});
 assert.equal((await request('/events?page=1',null)).data.total,0);
});
test('notification replay queues and delivers confirmation once and isolates SMTP failures',async()=>{
 const paid=await booking();await notifyBooking(paid);await notifyBooking(paid);assert.equal(await Notification.countDocuments(),1);
 await deliverNotifications();await deliverNotifications();assert.equal(mail.length,1);assert.equal(mail[0].html.includes(paid.qrToken),false);
 const failed=await booking({bookingStatus:'FAILED',paymentStatus:'failed',paymentVerifiedAt:undefined});await notifyBooking(failed);failMail=true;
 await deliverNotifications();assert.equal((await Booking.findById(paid._id)).paymentStatus,'paid');assert.equal(await Notification.countDocuments({status:'uncertain'}),1);
 failMail=false;await deliverNotifications();assert.equal(mail.length,1);
});

test('event creation validates capacity and dates and creates a pending event',async()=>{
  const date=new Date(Date.now()+172800000).toISOString().slice(0,10);
  const payload={title:'New event',description:'A new public event',date,startTime:'07:00 PM',endTime:'10:00 PM',location:'Kandy',ticketTypes:[{name:'General',price:12.50,quantity:20}]};
  const created=await request('/events',organizer,'POST',payload);assert.equal(created.status,201);assert.equal(created.data.approvalStatus,'pending');assert.equal(created.data.availableTickets,20);
  assert.equal((await request('/events',organizer,'POST',{...payload,ticketTypes:[{name:'General',price:12,quantity:1.5}]})).status,400);
  assert.equal((await request('/events',organizer,'POST',{...payload,endTime:'06:00 PM'})).status,400);
  assert.equal((await request('/events',customer,'POST',payload)).status,403);
});
test('concurrent reservation causes event edit conflict without losing reserved inventory',async()=>{
  const { createPendingBooking }=await import('../services/bookingService.js');
  const original=Event.findOneAndUpdate.bind(Event);let injected=false;
  const interception=mock.method(Event,'findOneAndUpdate',(...args)=>{
    if(!injected && args[1]?.$set?.approvalStatus==='pending') {
      injected=true;
      return (async () => {
        await createPendingBooking(customer,{eventId:String(event._id),locationId:String(event.locations[0]._id),ticketTierId:String(event.locations[0].ticketTiers[0]._id),ticketQuantity:1},crypto.randomUUID());
        return original(...args);
      })();
    }
    return original(...args);
  });
  try {
    const payload=editable();payload.locations[0].ticketTiers[0].totalQuantity=12;
    const result=await request('/events/'+event._id,organizer,'PUT',payload);assert.equal(result.status,409);
    const stored=await Event.findById(event._id);assert.equal(stored.availableTickets,9);assert.equal(stored.locations[0].ticketTiers[0].reservedQuantity,1);assert.equal(stored.totalCapacity,10);
  } finally { interception.mock.restore(); }
});
test('dashboard lifecycle counts distinguish ongoing, completed and cancelled events',async()=>{
  const copy=event.toObject();delete copy._id;delete copy.createdAt;delete copy.updatedAt;
  await Event.create({...copy,title:'Ongoing',startDateTime:new Date(Date.now()-10000),endDateTime:new Date(Date.now()+10000)});
  await Event.create({...copy,title:'Completed',startDateTime:new Date(Date.now()-20000),endDateTime:new Date(Date.now()-10000)});
  await Event.create({...copy,title:'Cancelled',status:'cancelled',isCancelled:true});
  const result=await request('/analytics/organizer',organizer);assert.equal(result.data.summary.totalEvents,4);
  assert.equal(result.data.summary.upcoming,1);assert.equal(result.data.summary.ongoing,1);assert.equal(result.data.summary.completed,1);assert.equal(result.data.summary.cancelled,1);
});

test('stale booking confirmation is suppressed after cancellation',async()=>{
  const paid=await booking();await notifyBooking(paid);
  await Booking.updateOne({_id:paid._id},{$set:{bookingStatus:'CANCELLED',ticketStatus:'CANCELLED',refundRequested:true}});
  await deliverNotifications();
  assert.equal(await Notification.countDocuments({status:'suppressed'}),1);
  assert.equal(mail.some((message)=>message.subject==='Eventra booking confirmed'),false);
});
