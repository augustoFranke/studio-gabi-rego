# WhatsApp Notification System Guide

This guide outlines the architecture and steps to implement automated WhatsApp notifications for **Billing Reminders** and **Session Reminders**.

## 1. Recommended Provider

**Evolution API (Self-hosted or Cloud)** or **Z-API**
*   **Why:** Best cost-benefit for Brazilian numbers, supports text/media, and stable.
*   **Cost:** ~$5-10/month (Z-API) or Server costs (Evolution API).
*   **Alternative:** **Twilio** (Global standard, pay-per-message, stricter template rules for WhatsApp).

*For this guide, we assume a generic HTTP API interface (POST request) which fits 99% of providers.*

## 2. Architecture

### Database Schema (`prisma/schema.prisma`)
Existing `Notificacao` model is a good start but needs to track the specific entity (Payment/Appointment) to avoid duplicate sends.

```prisma
// Update suggestion
model Notificacao {
  // ... existing fields
  pagamentoId     String?     // Link to specific payment
  agendamentoId   String?     // Link to specific appointment
  status          String      @default("PENDENTE") // PENDENTE, ENVIADO, FALHA
  responseId      String?     // ID returned by the API
}
```

### Automation Flow (Cron Job)
Since this is a Next.js project, use **Vercel Cron** or a simple API route called by an external cron (e.g., GitHub Actions, EasyCron).

## 3. Implementation Steps

### Step 1: Provider Setup
1.  Register with the provider (e.g., Z-API).
2.  Scan the QR Code to link the studio's WhatsApp number.
3.  Get the `API_URL` and `API_TOKEN`.
4.  Add to `.env`:
    ```env
    WHATSAPP_API_URL=https://api.provider.com/send-text
    WHATSAPP_API_TOKEN=your-token-here
    ```

### Step 2: Create the Service (`src/lib/whatsapp.ts`)
Create a utility to handle the HTTP requests.

```typescript
export async function sendWhatsAppMessage(phone: string, message: string) {
  // Format phone: 55 + DDD + Number (remove special chars)
  const formattedPhone = "55" + phone.replace(/\D/g, "");
  
  const response = await fetch(process.env.WHATSAPP_API_URL!, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      phone: formattedPhone,
      message: message
    })
  });
  
  return response.json();
}
```

### Step 3: Billing Reminder Logic (`src/app/api/cron/reminders/route.ts`)
Create an API route to check for expiring payments.

**Logic:**
1.  **Find Payments:** Query `Pagamento` where:
    - `status` is `PENDENTE`.
    - `dataVencimento` is Tomorrow (or Today).
    - No `Notificacao` exists for this `pagamentoId` with type `COBRANCA`.
2.  **Loop & Send:**
    ```typescript
    const payments = await prisma.pagamento.findMany({
      where: {
        status: 'PENDENTE',
        dataVencimento: {
          equals: tomorrow // calculated date
        },
        // ensure we haven't sent yet (pseudo-code)
        notificacoes: { none: { type: 'COBRANCA' } }
      },
      include: { membro: { include: { usuario: true } } }
    });

    for (const p of payments) {
      if (!p.membro.telefone) continue;
      
      const msg = `Olá ${p.membro.usuario.nome}, lembrete: sua mensalidade vence amanhã (${formatDate(p.dataVencimento)}). Valor: R$ ${p.valor}.`;
      
      try {
        await sendWhatsAppMessage(p.membro.telefone, msg);
        // Log success in DB
        await prisma.notificacao.create({ ... });
      } catch (e) {
        console.error(e);
      }
    }
    ```

### Step 4: Schedule the Job (vercel.json)
Configure Vercel Cron to run this route daily.

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 9 * * *" 
    }
  ]
}
```
*Runs at 09:00 AM every day.*

## 4. Optional: Session Reminders
Follow the same pattern but query `Agendamento` for the current day.
- **Tip:** Run this cron hourly or use a specific time (e.g., 6 AM) to send reminders for all appointments of the day.

## 5. Privacy & Anti-Spam
- Always include an option to "Opt-out" (even if manual).
- Don't send more than 1 reminder per event.
- Use the `Notificacao` table to strictly enforce "Once per Event" logic.
