# 🎬 LIVE DEMO - Unsolved Tickets Workflow

## 3 Open Tickets Ready to Solve Live

| ID | Customer | Issue | Priority | Status |
|----|----------|-------|----------|--------|
| TT-74989205-0006 | Priya Sharma | Double billing issue | 🔴 HIGH | OPEN |
| TT-74989366-0007 | Vikram Kumar | Premium features not activated | 🔴 HIGH | OPEN |
| TT-74989516-0008 | Neha Patel | How to cancel subscription? | 🟡 MEDIUM | OPEN |

---

## Live Demo Workflow (5-10 minutes)

### Step 1: Login as Agent
```
Email: agent@trektribe.com
Password: Agent@123456
```

### Step 2: Go to Agent Dashboard
- View unassigned tickets
- Show statistics (1 high, 1 high, 1 medium priority)
- Highlight the urgent billing issue

### Step 3: Resolve Ticket #1 (Priya Sharma - Billing Issue) ⚠️
**Duration**: 2-3 minutes

1. Click on ticket **TT-74989205-0006**
2. Read the issue: "Double billing - charged twice for same month"
3. Assign ticket to yourself
4. Add response message:
   ```
   I sincerely apologize for the billing issue. I've reviewed your account 
   and confirmed the duplicate charge. I'm immediately processing a refund 
   for the extra charge - you should see it within 2-3 business days. 
   
   Additionally, I'm adding a 1-month credit to your account as compensation 
   for the inconvenience. Your next premium renewal will be discounted.
   
   Is there anything else I can help clarify?
   ```
5. Click "Resolve Ticket"
6. Show resolution confirmation

### Step 4: Resolve Ticket #2 (Vikram Kumar - Features Not Activated) 🔧
**Duration**: 2-3 minutes

1. Click on ticket **TT-74989366-0007**
2. Read the issue: "Paid for premium but features still locked"
3. Assign ticket to yourself
4. Add response message:
   ```
   Thank you for reaching out! I see the issue - your payment processed 
   but the premium features haven't been activated yet. This sometimes 
   happens due to a delay in our system.
   
   I've manually activated your premium account right now. Please:
   1. Refresh your browser (Ctrl+F5 or Cmd+Shift+R)
   2. Log out and log back in
   3. You should now see all premium features:
      - Advanced Analytics Dashboard
      - Unlimited Group Bookings
      - Priority 24/7 Support
      - Custom Branding Tools
   
   Let me know if you still don't see the features!
   ```
5. Click "Resolve Ticket"
6. Demonstrate the quick troubleshooting steps

### Step 5: Resolve Ticket #3 (Neha Patel - Cancellation Policy) 📋
**Duration**: 2-3 minutes

1. Click on ticket **TT-74989516-0008**
2. Read the issue: "How to cancel and refund eligibility?"
3. Assign ticket to yourself
4. Add response message:
   ```
   Great question! Here's our cancellation policy:
   
   ✅ REFUND ELIGIBILITY:
   • Within 7 days of purchase: Full refund
   • Within 14 days: 75% refund
   • Within 30 days: 50% refund
   • After 30 days: No refund (but can cancel anytime)
   
   📝 HOW TO CANCEL:
   1. Go to Account Settings → Subscriptions
   2. Click "Manage Premium Organizer"
   3. Select "Cancel Subscription"
   4. Choose refund reason (optional)
   5. Confirm cancellation
   
   Since you purchased 2 days ago, you're eligible for a FULL REFUND!
   
   Would you like me to process the cancellation for you right now, 
   or would you like to do it yourself?
   ```
5. Click "Resolve Ticket"
6. Highlight the quick cancellation process

---

## Key Points to Highlight

✅ **Efficiency**: Resolved 3 complex issues in under 10 minutes

✅ **Agent Empowerment**: 
- Quick issue identification
- Authority to refund and compensate
- Ability to manually activate features

✅ **Customer-Centric**:
- Personalized responses
- Clear action steps
- Transparency on policies

✅ **System Integration**:
- Full conversation history
- Email notifications sent automatically
- Ticket status tracking
- Priority-based routing

✅ **Quality Control**:
- All tickets properly documented
- Audit trail of actions
- Customer satisfaction focus

---

## Tips for Smooth Execution

1. **Have credentials ready** - Agent email/password visible
2. **Explain each step** - Walk audience through the UI
3. **Show the chat history** - Demonstrate full conversation context
4. **Point out priorities** - How urgent issues get routed first
5. **Mention email notifications** - Customers get notified of responses
6. **Ask for questions** - After each resolution

---

## Alternative Tickets (if needed)

If you want different issues or more tickets, you can edit:
- `seed-unsolved-tickets.ts` - Edit `UNSOLVED_TICKET_TEMPLATES` array
- Run `npm run demo:tickets:unsolved` again
- Or ask me to add more variations!

---

## Re-run Script Anytime

If you want fresh unsolved tickets:
```bash
cd services/api
npm run demo:tickets:unsolved
```

This will:
- Create new travelers (or use existing)
- Create 3 fresh unsolved tickets
- Reset them to OPEN status
- Display new ticket IDs

---

## Related Documentation

- [Demo Guide](../DEMO_SUPPORT_TICKETS_GUIDE.md) - Overview of resolved tickets
- [Quick Reference](../SUPPORT_TICKETS_QUICK_REF.md) - Credentials and quick lookup
- [API Documentation](../API_DOCUMENTATION.md) - Technical details

---

**Status**: ✅ Ready for Live Demo  
**Tickets**: 3 open, high quality scenarios  
**Duration**: 5-10 minutes for complete workflow  
**Interactivity**: High - you solve them in real time! 🎬
