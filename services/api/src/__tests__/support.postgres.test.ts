import mongoose from 'mongoose';
import { prisma } from '../lib/prisma';
import { aiConversationService } from '../services/aiConversationService';

describe('Wave 6 support on Postgres', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const agentId = new mongoose.Types.ObjectId().toString();

  afterAll(async () => {
    await prisma.supportTicket.deleteMany({ where: { userId } });
    await prisma.ticket.deleteMany({ where: { requesterId: userId } });
    await prisma.aIConversation.deleteMany({ where: { sessionId: { startsWith: 'test-sess-' } } });
    await prisma.chatSession.deleteMany({ where: { sessionId: { startsWith: 'test-chat-' } } });
    await prisma.chatMessage.deleteMany({ where: { conversationId: { startsWith: 'test-conv-' } } });
  });

  beforeEach(async () => {
    await prisma.supportTicket.deleteMany({ where: { userId } });
    await prisma.ticket.deleteMany({ where: { requesterId: userId } });
    await prisma.aIConversation.deleteMany({ where: { sessionId: { startsWith: 'test-sess-' } } });
    await prisma.chatSession.deleteMany({ where: { sessionId: { startsWith: 'test-chat-' } } });
    await prisma.chatMessage.deleteMany({ where: { conversationId: { startsWith: 'test-conv-' } } });
  });

  const makeTicket = (over: any = {}) =>
    prisma.supportTicket.create({
      data: {
        userId,
        subject: 'Help please',
        description: 'Something went wrong.',
        customerEmail: 'a@b.com',
        customerName: 'A',
        ...over
      }
    });

  // ─── ticket ids come from a sequence, not a count ───────────────────────────

  it('gives every ticket a distinct id without counting rows', async () => {
    const made = await Promise.all([makeTicket(), makeTicket(), makeTicket()]);
    const ids = made.map(t => t.ticketId);

    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      expect(id).toMatch(/^TT-\d{6}-\d{4}$/);
    }
  });

  it('gives Ticket its own sequence with its own prefix', async () => {
    const a = await prisma.ticket.create({
      data: {
        subject: 'S', description: 'D', category: 'booking',
        requesterId: userId, requesterType: 'user'
      }
    });
    expect(a.ticketNumber).toMatch(/^TKT-\d{6}-\d{4}$/);
  });

  // ─── the status sets really are different ───────────────────────────────────

  it('refuses a SupportTicket status on a Ticket', async () => {
    await expect(
      prisma.ticket.create({
        data: {
          subject: 'S', description: 'D', category: 'booking',
          requesterId: userId, requesterType: 'user',
          status: 'open' as any
        }
      })
    ).rejects.toBeDefined();
  });

  it('stores the SupportTicket labels with their hyphens', async () => {
    const t = await makeTicket({ status: 'in_progress' });

    const raw = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status::text FROM support_tickets WHERE id = ${t.id}
    `;
    // The Prisma member is in_progress; what lands in the column is 'in-progress',
    // which is what Mongo holds, so a backfill needs no translation.
    expect(raw[0].status).toBe('in-progress');
  });

  // ─── messages are rows ──────────────────────────────────────────────────────

  it('records two replies that arrive together, losing neither', async () => {
    const ticket = await makeTicket();

    await Promise.all([
      prisma.supportTicketMessage.create({
        data: { ticketId: ticket.id, sender: 'agent', senderName: 'One', message: 'first' }
      }),
      prisma.supportTicketMessage.create({
        data: { ticketId: ticket.id, sender: 'agent', senderName: 'Two', message: 'second' }
      })
    ]);

    const messages = await prisma.supportTicketMessage.findMany({
      where: { ticketId: ticket.id }
    });
    expect(messages).toHaveLength(2);
  });

  it('takes a ticket messages with it when it is deleted', async () => {
    const ticket = await makeTicket();
    await prisma.supportTicketMessage.create({
      data: { ticketId: ticket.id, sender: 'customer', senderName: 'A', message: 'hi' }
    });

    await prisma.supportTicket.delete({ where: { id: ticket.id } });

    expect(await prisma.supportTicketMessage.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  // ─── claiming is decided by the database ────────────────────────────────────

  it('lets only one agent claim an unassigned ticket', async () => {
    const ticket = await makeTicket();
    const other = new mongoose.Types.ObjectId().toString();

    const first = await prisma.supportTicket.updateMany({
      where: { id: ticket.id, assignedAgentId: null },
      data: { assignedAgentId: agentId }
    });
    const second = await prisma.supportTicket.updateMany({
      where: { id: ticket.id, assignedAgentId: null },
      data: { assignedAgentId: other }
    });

    expect(first.count).toBe(1);
    expect(second.count).toBe(0);
    expect((await prisma.supportTicket.findUnique({ where: { id: ticket.id } }))!.assignedAgentId)
      .toBe(agentId);
  });

  it('refuses a satisfaction rating outside 1 to 5', async () => {
    const ticket = await makeTicket();
    await expect(
      prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { customerSatisfactionRating: 6 }
      })
    ).rejects.toBeDefined();
  });

  // ─── AI conversations ───────────────────────────────────────────────────────

  it('creates a conversation once for a session id', async () => {
    const sessionId = 'test-sess-1';
    const a = await aiConversationService.getOrCreateConversation(sessionId, userId);
    const b = await aiConversationService.getOrCreateConversation(sessionId, userId);

    expect(b.id).toBe(a.id);
    expect(await prisma.aIConversation.count({ where: { sessionId } })).toBe(1);
  });

  it('compresses to the last eight messages once past fifteen', async () => {
    const sessionId = 'test-sess-2';
    for (let i = 0; i < 16; i++) {
      await aiConversationService.addUserMessage(sessionId, 'message ' + i);
    }

    const conversation = await prisma.aIConversation.findUnique({ where: { sessionId } });
    const kept = await prisma.aIConversationMessage.findMany({
      where: { conversationId: conversation!.id },
      orderBy: { timestamp: 'asc' }
    });

    expect(kept).toHaveLength(8);
    // the oldest were deleted, not the newest
    expect(kept[kept.length - 1].content).toBe('message 15');
    // and what they were about survives in the summary
    expect(conversation!.summary).not.toBeNull();
  });

  it('pushes the expiry out on every message', async () => {
    const sessionId = 'test-sess-3';
    await aiConversationService.addUserMessage(sessionId, 'hello');

    const conversation = await prisma.aIConversation.findUnique({ where: { sessionId } });
    expect(conversation!.expiresAt).not.toBeNull();
    // roughly 30 days out - the TTL the Mongo index used to enforce
    const days = (conversation!.expiresAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);
  });

  it('finds unassigned escalations by column, not by JSON path', async () => {
    await prisma.aIConversation.create({
      data: { sessionId: 'test-sess-4', escalated: true, escalationReason: 'angry' }
    });
    await prisma.aIConversation.create({
      data: { sessionId: 'test-sess-5', escalated: true, assignedAgentId: agentId }
    });

    const unassigned = await aiConversationService.getEscalatedConversations();
    const sessions = unassigned.map(c => c.sessionId);

    expect(sessions).toContain('test-sess-4');
    expect(sessions).not.toContain('test-sess-5');
  });

  // ─── chat ───────────────────────────────────────────────────────────────────

  it('splits relatedTo into two queryable columns', async () => {
    const row = await prisma.chatMessage.create({
      data: {
        conversationId: 'test-conv-1',
        senderId: userId,
        senderType: 'user',
        message: 'about my booking',
        relatedToType: 'booking',
        relatedToId: 'booking-9'
      }
    });

    expect(row.relatedToType).toBe('booking');

    const found = await prisma.chatMessage.findMany({
      where: { relatedToType: 'booking', relatedToId: 'booking-9' }
    });
    expect(found.map(f => f.id)).toContain(row.id);
  });

  it('refuses a chat confidence outside 0 to 1', async () => {
    const session = await prisma.chatSession.create({ data: { sessionId: 'test-chat-1' } });

    await expect(
      prisma.chatSessionMessage.create({
        data: { sessionId: session.id, sender: 'ai', message: 'hi', confidence: 1.5 }
      })
    ).rejects.toBeDefined();
  });
});
