import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";
const APP_NAME = "TimeZone";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SendOrgAdminInviteParams {
  to: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  tempPassword: string;
}

export async function sendOrgAdminInvite({
  to,
  firstName,
  lastName,
  organizationName,
  tempPassword,
}: SendOrgAdminInviteParams) {
  const loginUrl = `${APP_URL}/login`;

  const { data, error } = await resend.emails.send({
    from: `${APP_NAME} <${FROM_EMAIL}>`,
    to: [to],
    subject: `You've been invited to manage ${organizationName} on ${APP_NAME}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ${APP_NAME}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
                      <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background-color: #18181b; border-radius: 12px; margin-bottom: 16px;">
                        <span style="color: #ffffff; font-size: 24px; font-weight: bold;">T</span>
                      </div>
                      <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">Welcome to ${APP_NAME}</h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
                        Hello ${firstName} ${lastName},
                      </p>
                      <p style="margin: 0 0 24px; font-size: 16px; color: #3f3f46; line-height: 1.6;">
                        You've been invited to be the <strong>Organization Admin</strong> for <strong>${organizationName}</strong> on ${APP_NAME}. As an admin, you'll be able to manage employees, view time entries, and configure organization settings.
                      </p>

                      <!-- Credentials Box -->
                      <div style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                        <h3 style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Your Login Credentials</h3>
                        <p style="margin: 0 0 8px; font-size: 14px; color: #3f3f46;">
                          <strong>Email:</strong> ${to}
                        </p>
                        <p style="margin: 0; font-size: 14px; color: #3f3f46;">
                          <strong>Temporary Password:</strong> <code style="background-color: #e4e4e7; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${tempPassword}</code>
                        </p>
                      </div>

                      <!-- Warning -->
                      <p style="margin: 0 0 24px; font-size: 14px; color: #dc2626; background-color: #fef2f2; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #dc2626;">
                        <strong>Important:</strong> Please change your password after your first login for security purposes.
                      </p>

                      <!-- CTA Button -->
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td align="center">
                            <a href="${loginUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 500; border-radius: 8px;">
                              Login to ${APP_NAME}
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 24px 0 0; font-size: 14px; color: #71717a; text-align: center;">
                        Or copy and paste this URL into your browser:<br>
                        <a href="${loginUrl}" style="color: #2563eb; text-decoration: underline;">${loginUrl}</a>
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #e4e4e7; border-radius: 0 0 12px 12px;">
                      <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">
                        This email was sent by ${APP_NAME}. If you didn't expect this invitation, please ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `
Hello ${firstName} ${lastName},

You've been invited to be the Organization Admin for ${organizationName} on ${APP_NAME}.

Your Login Credentials:
- Email: ${to}
- Temporary Password: ${tempPassword}

IMPORTANT: Please change your password after your first login for security purposes.

Login at: ${loginUrl}

This email was sent by ${APP_NAME}. If you didn't expect this invitation, please ignore this email.
    `.trim(),
  });

  if (error) {
    console.error("Failed to send invitation email:", error);
    throw new Error(`Failed to send invitation email: ${error.message}`);
  }

  return data;
}
