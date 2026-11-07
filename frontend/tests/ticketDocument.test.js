import test from 'node:test';
import assert from 'node:assert/strict';
import { ticketDocument } from '../src/api/ticketDocument.js';
const booking = { canUseTicket:true,bookingStatus:'CONFIRMED',paymentStatus:'paid',paymentVerifiedAt:'2027-01-01',ticketStatus:'VALID',qrToken:'TKT-'+'a'.repeat(64),bookingId:'BKG-123',eventId:{title:'Music <script>alert(1)</script>',startDateTime:'2027-01-01T12:00:00Z',location:'Colombo'},ticketType:'General',ticketQuantity:2, stripePaymentIntentId:'private-id',customerEmail:'private@test.invalid' };
test('download escapes event text and excludes private/payment fields',()=>{
 const svg=ticketDocument(booking,'<svg/>');assert.ok(svg.includes('&lt;script&gt;'));assert.ok(svg.includes('BKG-123'));assert.ok(svg.includes('Quantity: 2'));assert.equal(svg.includes('private-id'),false);assert.equal(svg.includes('private@test.invalid'),false);
});
test('download rejects cancelled, unverified, used and refund-requested tickets',()=>{
 for(const extra of [{canUseTicket:false},{bookingStatus:'CANCELLED'},{paymentStatus:'refunded'},{ticketStatus:'USED'},{refundRequested:true},{paymentReviewRequired:true},{paymentVerifiedAt:null}])assert.throws(()=>ticketDocument({...booking,...extra},'<svg/>'));
});
