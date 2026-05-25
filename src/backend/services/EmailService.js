const nodemailer = require('nodemailer');

let cachedTransport = null;

function getConfig() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';

  if (!host || !from) {
    throw new Error('SMTP не настроен. Укажите SMTP_HOST и SMTP_FROM');
  }

  return {
    host,
    port,
    user,
    pass,
    from,
    secure,
    appBaseUrl: appBaseUrl.replace(/\/$/, '')
  };
}

function getTransport() {
  if (cachedTransport) {
    return cachedTransport;
  }

  const config = getConfig();
  cachedTransport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined
  });

  return cachedTransport;
}

async function sendVerifyEmail({ to, username, token }) {
  const config = getConfig();
  const verifyUrl = `${config.appBaseUrl}/verify-email?token=${encodeURIComponent(token)}&username=${encodeURIComponent(username)}`;
  const subject = 'Подтверждение почты для PUBG турнира';
  const text = `Подтвердите почту для аккаунта ${username}.\n` +
    `Перейдите по ссылке: ${verifyUrl}\n` +
    `Ссылка действительна 1 час. Если запрос был не вами, просто игнорируйте письмо.`;

  const html = `
    <p>Подтвердите почту для аккаунта <strong>${username}</strong>.</p>
    <p>Перейдите по ссылке:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>Ссылка действительна 1 час. Если запрос был не вами, просто игнорируйте письмо.</p>
  `;

  const transport = getTransport();
  await transport.sendMail({
    from: config.from,
    to,
    subject,
    text,
    html
  });
}

module.exports = { sendVerifyEmail };
