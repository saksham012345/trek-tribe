import nodemailer from 'nodemailer';
import { User } from '../models/User';
import { RealTimeChat } from '../models/RealTimeChat';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.setupTransporter();
  }

  private setupTransporter() {
    try {
      const emailConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false
        }
      };

      if (!emailConfig.auth.user || !emailConfig.auth.pass) {
        console.warn('⚠️  Email Service: SMTP credentials not configured');
        return;
      }

      this.transporter = nodemailer.createTransport(emailConfig);
      this.isEnabled = true;
      console.log('✅ Email Service initialized successfully');
      
      // Verify connection
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('❌ Email Service verification failed:', error);
          this.isEnabled = false;
        } else {
          console.log('📧 Email Service ready to send emails');
        }
      });
    } catch (error) {
      console.error('❌ Email Service initialization failed:', error);
      this.isEnabled = false;
    }
  }

  private getTemplate(type: string, data: any): EmailTemplate {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    switch (type) {
      case 'chat_started':
        return {
          subject: 'Your support chat has been created - Trek Tribe',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
                <h1>🏔️ Trek Tribe Support</h1>
                <h2>Your Support Chat Has Been Created</h2>
              </div>
              
              <div style="padding: 30px; background: #f9f9f9;">
                <p>Hi <strong>${data.userName}</strong>,</p>
                
                <p>We've received your support request and created a chat session for you:</p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                  <h3 style="margin: 0 0 10px 0;">Chat Details</h3>
                  <p><strong>Subject:</strong> ${data.subject}</p>
                  <p><strong>Priority:</strong> ${data.priority}</p>
                  <p><strong>Chat ID:</strong> ${data.roomId}</p>
                </div>
                
                <p>An agent will be assigned to assist you shortly. You can continue the conversation by clicking the button below:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${baseUrl}/support/chat/${data.roomId}" 
                     style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Continue Chat
                  </a>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                  Average response time: Less than 30 minutes during business hours
                </p>
              </div>
              
              <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
                <p>Best regards,<br>The Trek Tribe Support Team</p>
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          `,
          text: `
Trek Tribe Support - Your Support Chat Has Been Created

Hi ${data.userName},

We've received your support request and created a chat session for you:

Subject: ${data.subject}
Priority: ${data.priority}
Chat ID: ${data.roomId}

An agent will be assigned to assist you shortly. You can continue the conversation at:
${baseUrl}/support/chat/${data.roomId}

Average response time: Less than 30 minutes during business hours

Best regards,
The Trek Tribe Support Team
          `
        };

      case 'agent_assigned':
        return {
          subject: 'Agent assigned to your support chat - Trek Tribe',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
                <h1>🏔️ Trek Tribe Support</h1>
                <h2>Agent Assigned to Your Chat</h2>
              </div>
              
              <div style="padding: 30px; background: #f9f9f9;">
                <p>Hi <strong>${data.userName}</strong>,</p>
                
                <p>Good news! <strong>${data.agentName}</strong> has been assigned to help you with your support request.</p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                  <h3 style="margin: 0 0 10px 0;">Your Support Agent</h3>
                  <p><strong>Agent:</strong> ${data.agentName}</p>
                  <p><strong>Chat Subject:</strong> ${data.subject}</p>
                  <p><strong>Status:</strong> Active</p>
                </div>
                
                <p>Click the button below to continue your conversation:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${baseUrl}/support/chat/${data.roomId}" 
                     style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Open Chat
                  </a>
                </div>
              </div>
              
              <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
                <p>Best regards,<br>The Trek Tribe Support Team</p>
              </div>
            </div>
          `,
          text: `
Trek Tribe Support - Agent Assigned to Your Chat

Hi ${data.userName},

Good news! ${data.agentName} has been assigned to help you with your support request.

Agent: ${data.agentName}
Chat Subject: ${data.subject}
Status: Active

Continue your conversation at:
${baseUrl}/support/chat/${data.roomId}

Best regards,
The Trek Tribe Support Team
          `
        };

      case 'chat_closed':
        return {
          subject: 'Your support chat has been closed - Trek Tribe',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
                <h1>🏔️ Trek Tribe Support</h1>
                <h2>Support Chat Closed</h2>
              </div>
              
              <div style="padding: 30px; background: #f9f9f9;">
                <p>Hi <strong>${data.userName}</strong>,</p>
                
                <p>Your support chat session has been closed.</p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6c757d;">
                  <h3 style="margin: 0 0 10px 0;">Chat Summary</h3>
                  <p><strong>Subject:</strong> ${data.subject}</p>
                  <p><strong>Duration:</strong> ${data.duration || 'N/A'}</p>
                  <p><strong>Closed by:</strong> ${data.closedBy}</p>
                  ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
                </div>
                
                <p>We hope we were able to resolve your issue. If you need further assistance, please don't hesitate to contact us again.</p>
                
                ${!data.satisfaction ? `
                <div style="text-align: center; margin: 30px 0;">
                  <p><strong>How was your experience?</strong></p>
                  <a href="${baseUrl}/support/feedback/${data.roomId}?rating=5" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 0 5px;">Excellent</a>
                  <a href="${baseUrl}/support/feedback/${data.roomId}?rating=3" style="background: #ffc107; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 0 5px;">Good</a>
                  <a href="${baseUrl}/support/feedback/${data.roomId}?rating=1" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 0 5px;">Poor</a>
                </div>
                ` : ''}
              </div>
              
              <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
                <p>Thank you for choosing Trek Tribe!<br>The Trek Tribe Support Team</p>
              </div>
            </div>
          `,
          text: `
Trek Tribe Support - Support Chat Closed

Hi ${data.userName},

Your support chat session has been closed.

Subject: ${data.subject}
Duration: ${data.duration || 'N/A'}
Closed by: ${data.closedBy}
${data.reason ? `Reason: ${data.reason}` : ''}

We hope we were able to resolve your issue. If you need further assistance, please don't hesitate to contact us again.

${!data.satisfaction ? `
Rate your experience:
${baseUrl}/support/feedback/${data.roomId}
` : ''}

Thank you for choosing Trek Tribe!
The Trek Tribe Support Team
          `
        };

      case 'new_chat_agent_notification':
        return {
          subject: 'New support chat assigned to you - Trek Tribe',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%); color: white; padding: 30px; text-align: center;">
                <h1>🚨 Trek Tribe Agent Portal</h1>
                <h2>New Chat Assignment</h2>
              </div>
              
              <div style="padding: 30px; background: #f9f9f9;">
                <p>Hi <strong>${data.agentName}</strong>,</p>
                
                <p>A new support chat has been assigned to you:</p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
                  <h3 style="margin: 0 0 10px 0;">Chat Details</h3>
                  <p><strong>Customer:</strong> ${data.userName}</p>
                  <p><strong>Subject:</strong> ${data.subject}</p>
                  <p><strong>Priority:</strong> <span style="color: ${data.priority === 'urgent' ? '#dc3545' : data.priority === 'high' ? '#fd7e14' : '#28a745'}">${data.priority.toUpperCase()}</span></p>
                  <p><strong>Waiting Time:</strong> ${data.waitingTime}</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${baseUrl}/agent/chat/${data.roomId}" 
                     style="background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Handle Chat Now
                  </a>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                  Please respond as soon as possible to maintain our service level agreements.
                </p>
              </div>
            </div>
          `,
          text: `
Trek Tribe Agent Portal - New Chat Assignment

Hi ${data.agentName},

A new support chat has been assigned to you:

Customer: ${data.userName}
Subject: ${data.subject}
Priority: ${data.priority.toUpperCase()}
Waiting Time: ${data.waitingTime}

Handle the chat at: ${baseUrl}/agent/chat/${data.roomId}

Please respond as soon as possible to maintain our service level agreements.
          `
        };

      default:
        throw new Error(`Unknown email template type: ${type}`);
    }
  }

  async sendChatStartedNotification(userId: string, chatData: any): Promise<boolean> {
    if (!this.isEnabled || !this.transporter) return false;

    try {
      const user = await User.findById(userId).select('name email');
      if (!user || !user.email) return false;

      const template = this.getTemplate('chat_started', {
        userName: user.name,
        ...chatData
      });

      await this.transporter.sendMail({
        from: `"Trek Tribe Support" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      console.log(`📧 Chat started notification sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send chat started notification:', error);
      return false;
    }
  }

  async sendAgentAssignedNotification(userId: string, agentId: string, chatData: any): Promise<boolean> {
    if (!this.isEnabled || !this.transporter) return false;

    try {
      const [user, agent] = await Promise.all([
        User.findById(userId).select('name email'),
        User.findById(agentId).select('name email')
      ]);

      if (!user || !user.email) return false;

      const template = this.getTemplate('agent_assigned', {
        userName: user.name,
        agentName: agent?.name || 'Support Agent',
        ...chatData
      });

      await this.transporter.sendMail({
        from: `"Trek Tribe Support" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      console.log(`📧 Agent assigned notification sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send agent assigned notification:', error);
      return false;
    }
  }

  async sendChatClosedNotification(userId: string, chatData: any): Promise<boolean> {
    if (!this.isEnabled || !this.transporter) return false;

    try {
      const user = await User.findById(userId).select('name email');
      if (!user || !user.email) return false;

      const template = this.getTemplate('chat_closed', {
        userName: user.name,
        ...chatData
      });

      await this.transporter.sendMail({
        from: `"Trek Tribe Support" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      console.log(`📧 Chat closed notification sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send chat closed notification:', error);
      return false;
    }
  }

  async sendNewChatAgentNotification(agentId: string, chatData: any): Promise<boolean> {
    if (!this.isEnabled || !this.transporter) return false;

    try {
      const [agent, user] = await Promise.all([
        User.findById(agentId).select('name email'),
        User.findById(chatData.userId).select('name')
      ]);

      if (!agent || !agent.email) return false;

      const template = this.getTemplate('new_chat_agent_notification', {
        agentName: agent.name,
        userName: user?.name || 'Customer',
        ...chatData
      });

      await this.transporter.sendMail({
        from: `"Trek Tribe Agent Portal" <${process.env.SMTP_USER}>`,
        to: agent.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      console.log(`📧 New chat assignment notification sent to agent ${agent.email}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send new chat agent notification:', error);
      return false;
    }
  }

  async sendBulkNotification(recipients: string[], subject: string, content: string): Promise<number> {
    if (!this.isEnabled || !this.transporter) return 0;

    let sentCount = 0;
    const batchSize = 10; // Send in batches to avoid overwhelming the SMTP server

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      try {
        await Promise.all(
          batch.map(async (email) => {
            await this.transporter!.sendMail({
              from: `"Trek Tribe" <${process.env.SMTP_USER}>`,
              to: email,
              subject,
              html: content,
              text: content.replace(/<[^>]*>/g, ''), // Strip HTML for text version
            });
            sentCount++;
          })
        );
        
        // Small delay between batches
        if (i + batchSize < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`❌ Failed to send bulk notification to batch ${i / batchSize + 1}:`, error);
      }
    }

    console.log(`📧 Bulk notification sent to ${sentCount}/${recipients.length} recipients`);
    return sentCount;
  }

  isServiceEnabled(): boolean {
    return this.isEnabled;
  }
}

// Singleton instance
export const emailService = new EmailService();