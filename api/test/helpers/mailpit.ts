/** API HTTP de Mailpit (bandeja de desarrollo). En local y en CI escucha en el 8025. */
export const mailpitUrl = process.env.MAILPIT_API_URL ?? 'http://localhost:8025';
export const smtpHost = process.env.SMTP_HOST ?? 'localhost';
export const smtpPort = Number(process.env.SMTP_PORT ?? 1025);

interface MailpitSummary {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

export async function clearMailbox(): Promise<void> {
  const res = await fetch(`${mailpitUrl}/api/v1/messages`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Mailpit respondió ${res.status} al vaciar la bandeja`);
}

/** Mensajes dirigidos a `address`, con su cuerpo de texto. */
export async function messagesTo(
  address: string,
): Promise<{ subject: string; text: string; html: string }[]> {
  const res = await fetch(`${mailpitUrl}/api/v1/messages?limit=200`);
  const { messages } = (await res.json()) as { messages: MailpitSummary[] };
  const mine = messages.filter((message) =>
    message.To.some((to) => to.Address.toLowerCase() === address.toLowerCase()),
  );
  return Promise.all(
    mine.map(async (message) => {
      const detail = (await (await fetch(`${mailpitUrl}/api/v1/message/${message.ID}`)).json()) as {
        Subject: string;
        Text: string;
        HTML: string;
      };
      return { subject: detail.Subject, text: detail.Text, html: detail.HTML };
    }),
  );
}
