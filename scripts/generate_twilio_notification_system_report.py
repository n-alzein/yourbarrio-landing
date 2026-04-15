from __future__ import annotations

import os
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT_PATH = "reports/twilio_notification_system_report.pdf"


def build_styles():
    styles = getSampleStyleSheet()

    styles.add(
        ParagraphStyle(
            name="ReportTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=30,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=18,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ReportSubtitle",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=11,
            leading=16,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#475569"),
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SectionHeading",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#111827"),
            spaceBefore=12,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SubHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#1F2937"),
            spaceBefore=8,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=15,
            alignment=TA_LEFT,
            textColor=colors.HexColor("#334155"),
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BulletLike",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=15,
            leftIndent=10,
            bulletIndent=0,
            textColor=colors.HexColor("#334155"),
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Callout",
            parent=styles["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#475569"),
            backColor=colors.HexColor("#F8FAFC"),
            borderPadding=8,
            borderColor=colors.HexColor("#CBD5E1"),
            borderWidth=0.5,
            borderRadius=4,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="MonoLabel",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=4,
        )
    )
    return styles


def add_paragraphs(story, styles, paragraphs):
    for paragraph in paragraphs:
        story.append(Paragraph(paragraph, styles["Body"]))


def section_title(story, styles, title):
    story.append(Paragraph(title, styles["SectionHeading"]))


def subheading(story, styles, title):
    story.append(Paragraph(title, styles["SubHeading"]))


def bullet(story, styles, text):
    story.append(Paragraph(f"• {text}", styles["BulletLike"]))


def ascii_block(text):
    return Preformatted(
        text,
        ParagraphStyle(
            "AsciiFlow",
            fontName="Courier",
            fontSize=9,
            leading=12,
            leftIndent=10,
            textColor=colors.HexColor("#0F172A"),
            backColor=colors.HexColor("#F8FAFC"),
            borderPadding=8,
            borderColor=colors.HexColor("#CBD5E1"),
            borderWidth=0.5,
        ),
    )


def build_env_table():
    data = [
        ["Variable", "How the code uses it", "Notes"],
        ["TWILIO_ACCOUNT_SID", "Creates the Twilio SDK client", "Required"],
        ["TWILIO_AUTH_TOKEN", "Authenticates SDK calls and validates webhook signatures", "Required"],
        [
            "TWILIO_FROM_NUMBER",
            "Sender phone number passed to Twilio when sending SMS",
            "Required in this codebase",
        ],
        [
            "TWILIO_STATUS_CALLBACK_URL",
            "Webhook URL Twilio should call with message status updates",
            "Required in this codebase",
        ],
        [
            "TWILIO_PHONE_NUMBER",
            "Business-facing alias often used in docs",
            "Not the variable name used by the current code",
        ],
    ]
    table = Table(data, colWidths=[1.8 * inch, 3.1 * inch, 1.8 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("LEADING", (0, 0), (-1, -1), 12),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def build_source_table():
    data = [
        ["Area", "Primary files"],
        ["Twilio send logic", "lib/integrations/twilio.ts"],
        ["Notification orchestration", "lib/notifications/orders.ts"],
        ["Webhook handler", "app/api/twilio/status/route.ts"],
        ["Companion webhook flow", "app/api/webhooks/twilio/message-status/route.ts"],
        ["Schema", "supabase/migrations/20260413100000_add_order_notification_pipeline.sql"],
        ["Provider status fields", "supabase/migrations/20260414120000_add_twilio_provider_status_fields.sql"],
        ["Tests", "tests/twilio-status-route.unit.test.ts, tests/order-notification-pipeline.unit.test.ts"],
    ]
    table = Table(data, colWidths=[1.8 * inch, 5.0 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def build_story():
    styles = build_styles()
    story = []

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    story.append(Spacer(1, 1.2 * inch))
    story.append(Paragraph("YourBarrio Notification System – Twilio Integration", styles["ReportTitle"]))
    story.append(
        Paragraph(
            "A plain-English engineering report describing how YourBarrio creates, sends, tracks, and updates SMS order notifications through Twilio.",
            styles["ReportSubtitle"],
        )
    )
    story.append(
        Paragraph(
            "Audience: product managers, new engineers, technical investors, and external partners who need a reliable end-to-end explanation of the current implementation.",
            styles["ReportSubtitle"],
        )
    )
    story.append(Spacer(1, 0.3 * inch))
    story.append(
        Paragraph(
            f"Generated from code inspection on {generated_at}.",
            styles["ReportSubtitle"],
        )
    )
    story.append(PageBreak())

    section_title(story, styles, "1. Executive Summary")
    add_paragraphs(
        story,
        styles,
        [
            "YourBarrio uses Twilio to send SMS alerts when a new paid order is created and when a business has not acknowledged that order quickly enough. In simple terms, the platform watches for order events, creates a notification log in Supabase, sends a text message through Twilio, and then listens for delivery updates from Twilio so the database reflects what happened in the real world.",
            "The business value is speed and accountability. A marketplace order is only useful if the merchant notices it quickly. SMS is the fastest and most dependable channel for urgent operational alerts, especially for small businesses that may not be watching a dashboard every minute.",
            "A key implementation detail is that the current Twilio flow is merchant-facing, not customer-facing. The text messages are sent to a business order alert phone number so the business can react to a newly paid order or an unacknowledged order.",
        ],
    )

    section_title(story, styles, "2. System Overview")
    add_paragraphs(
        story,
        styles,
        [
            "The notification system sits beside the order lifecycle. When checkout completes and an order enters the requested state, backend code starts the notification pipeline. It loads business contact settings, decides which channels are enabled, creates rows in the order_notifications table, and sends the SMS through Twilio.",
            "Twilio is responsible for the actual mobile delivery. YourBarrio is responsible for orchestration, idempotency, business rules, and record keeping. Supabase stores both the intent to notify and the latest known result.",
        ],
    )
    story.append(
        ascii_block(
            "Customer checkout completes\n"
            "        |\n"
            "        v\n"
            "YourBarrio backend (Stripe webhook)\n"
            "        |\n"
            "        v\n"
            "Supabase: create order_notifications row\n"
            "        |\n"
            "        v\n"
            "Twilio Messages API\n"
            "        |\n"
            "        v\n"
            "Business phone receives SMS\n"
            "        |\n"
            "        v\n"
            "Twilio status callback -> YourBarrio webhook -> Supabase update"
        )
    )
    story.append(Spacer(1, 10))
    story.append(
        Paragraph(
            "Short form flow: User Action → Backend → Database → Twilio API → Business Phone → Twilio Webhook → Database Update",
            styles["Callout"],
        )
    )

    section_title(story, styles, "3. Main Components")

    subheading(story, styles, "Supabase Database")
    add_paragraphs(
        story,
        styles,
        [
            "The central audit table is <b>order_notifications</b>. Each row represents one notification attempt for one order, such as the first SMS alert or a later reminder. This gives the system a durable history of what it tried to send and what Twilio reported back.",
            "Important fields are designed to answer operational questions. <b>provider_message_id</b> stores the Twilio Message SID so later callbacks can be matched to the correct row. <b>status</b> stores the application-level state such as pending, sent, delivered, failed, undelivered, or skipped. Timestamp fields such as <b>created_at</b>, <b>sent_at</b>, <b>delivered_at</b>, and <b>failed_at</b> show when each stage happened.",
            "The schema also includes <b>idempotency_key</b>, which prevents the same logical notification from being created twice. This matters because payment and webhook systems can legitimately deliver duplicate events.",
        ],
    )
    bullet(story, styles, "provider_message_id: the Twilio Message SID used as the external tracking key")
    bullet(story, styles, "status: the current application view of the notification lifecycle")
    bullet(story, styles, "attempt_number: how many send attempts were made")
    bullet(story, styles, "error_code and error_message: Twilio or system error details when a send fails")
    bullet(story, styles, "meta: extra JSON for raw provider details and internal troubleshooting context")

    subheading(story, styles, "Application and Backend")
    add_paragraphs(
        story,
        styles,
        [
            "The orchestration logic lives mainly in <b>lib/notifications/orders.ts</b>. This file loads order and business context, chooses destinations, creates pending notification rows, sends messages, updates state, and later processes reminder logic.",
            "The first send is triggered from the Stripe webhook after a paid order is finalized and moves into the requested state. That means Twilio delivery is coupled to a confirmed order event, not to a frontend button click.",
            "Message construction is intentionally simple. The new-order SMS includes the order number, total, customer name, and a link into the business orders view. Reminder SMS messages reuse the order number and dashboard link, but change the copy to signal that the order still needs attention.",
        ],
    )

    subheading(story, styles, "Twilio Outbound Messaging")
    add_paragraphs(
        story,
        styles,
        [
            "The Twilio integration is wrapped by <b>sendTwilioSms</b> in <b>lib/integrations/twilio.ts</b>. It creates a Twilio SDK client using the account SID and auth token, then calls <b>client.messages.create</b> with the destination number, sender number, message body, and status callback URL.",
            "Twilio returns a message object immediately after accepting the request. The most important identifier in that response is the <b>Message SID</b>. This is Twilio’s unique ID for the SMS. YourBarrio stores it as <b>provider_message_id</b> so later callbacks can be matched to the right database row.",
            "The send response can include a transport-level status such as queued or sent. The code maps these into simpler internal states so downstream parts of the application do not need to understand every Twilio-specific status value.",
        ],
    )

    subheading(story, styles, "Webhook and Status Callback Routes")
    add_paragraphs(
        story,
        styles,
        [
            "Twilio later calls a webhook when the message status changes. The route specifically requested in this report is <b>/api/twilio/status</b>. It reads form-encoded data from Twilio, validates the request signature, looks up the matching notification by Message SID, and updates provider-specific fields such as <b>provider_status</b>, <b>provider_error_code</b>, <b>provider_error_message</b>, and <b>last_provider_event_at</b>.",
            "The repository also contains a companion route at <b>/api/webhooks/twilio/message-status</b>. That path uses a shared helper to normalize callback statuses into application states like delivered or failed. Both routes show the same core design idea: Twilio tells YourBarrio what happened after send time, and YourBarrio persists the result.",
            "Signature validation matters because webhooks come from outside the platform. Without validation, any third party could pretend to be Twilio and mark messages as delivered or failed. The current code reconstructs the request URL carefully, including forwarded host and protocol headers, because signature checks are sensitive to the exact URL Twilio signed.",
        ],
    )

    subheading(story, styles, "Scheduling and Reminder Layer")
    add_paragraphs(
        story,
        styles,
        [
            "Reminder processing is handled by a protected internal route at <b>/api/internal/order-notification-reminders</b>. That route acquires a worker lock, finds orders that still need attention, sends reminder notifications, and performs lightweight stale-message reconciliation.",
            "The reminder policy is intentionally simple. SMS reminders become eligible after 5 minutes, email reminders after 15 minutes, and reminders stop once the order is acknowledged. This keeps the system understandable for operators and reduces the risk of spamming businesses.",
        ],
    )

    section_title(story, styles, "4. End-to-End Flow")
    bullets = [
        "1. A paid order event happens. In this codebase, the trigger comes from the Stripe webhook after checkout success or payment intent success.",
        "2. The backend loads order, business, and user context so it knows who should receive alerts.",
        "3. A new row is inserted into order_notifications with status = pending and a deterministic idempotency_key.",
        "4. The backend sends the SMS through Twilio and passes a status callback URL.",
        "5. Twilio immediately returns a Message SID. YourBarrio stores that value in provider_message_id.",
        "6. The order notification row is updated to pending or sent, depending on the immediate Twilio response.",
        "7. Twilio later calls back to the webhook with a status such as queued, sent, delivered, failed, or undelivered.",
        "8. YourBarrio validates the Twilio signature before trusting the payload.",
        "9. The webhook finds the matching order_notifications row by provider_message_id.",
        "10. The database is updated with provider status fields and, in the normalized flow, with final business-level timestamps such as delivered_at or failed_at.",
    ]
    for item in bullets:
        bullet(story, styles, item)

    story.append(
        ascii_block(
            "Stripe checkout webhook\n"
            "   -> sendNewOrderNotifications(orderId)\n"
            "   -> insert pending order_notifications row\n"
            "   -> Twilio send\n"
            "   -> store MessageSid on row\n"
            "   -> Twilio callback hits /api/twilio/status\n"
            "   -> validate signature\n"
            "   -> update provider_status and error fields\n"
            "   -> reporting and support teams can inspect the row later"
        )
    )

    section_title(story, styles, "5. Data Model Explanation")
    add_paragraphs(
        story,
        styles,
        [
            "The data model is built to answer three questions clearly: what notification was intended, what external provider handled it, and what finally happened. The <b>order_notifications</b> table links each notification row to an order, an owner user, and optionally a business entity.",
            "This is useful operationally because it lets a developer or support person move from an order record to its notification history without guessing which system produced the SMS.",
        ],
    )
    bullet(story, styles, "status: the internal lifecycle state used by the application")
    bullet(story, styles, "provider_message_id: Twilio’s Message SID, used to correlate callbacks")
    bullet(story, styles, "owner_user_id and business_entity_id: who owns the alert and which business it belongs to")
    bullet(story, styles, "created_at, sent_at, delivered_at, failed_at, last_provider_event_at: when each milestone happened")
    bullet(story, styles, "provider_status, provider_error_code, provider_error_message: Twilio-specific tracking details")
    bullet(story, styles, "meta: flexible JSON for raw callback payloads and troubleshooting data")

    section_title(story, styles, "6. Message Content")
    add_paragraphs(
        story,
        styles,
        [
            "Message text is defined in <b>lib/notifications/orders.ts</b>. The code builds one SMS body for a new order and a second SMS body for reminders. Both messages include the order number and a deep link back to the business orders page.",
            "The main trigger for the first SMS is a successful paid-order event from the Stripe webhook. Reminder messages are triggered later by the internal reminder worker if the order remains unacknowledged.",
            "The current message content is concise and operational. It is designed to get a merchant back into the dashboard quickly, not to provide a long customer-facing explanation.",
        ],
    )
    story.append(
        ascii_block(
            "New-order SMS pattern\n"
            "  New order on YourBarrio: Order #YB-1001, $32.50 from Sarah. View: <order URL>\n\n"
            "Reminder SMS pattern\n"
            "  Reminder: Order #YB-1001 is still waiting in YourBarrio. View: <order URL>"
        )
    )

    section_title(story, styles, "7. Security and Safety")
    add_paragraphs(
        story,
        styles,
        [
            "Webhook security starts with Twilio signature validation. The server reads the <b>x-twilio-signature</b> header and uses the Twilio SDK to confirm that the callback body and URL match what Twilio signed. If the signature is missing or invalid, the route returns HTTP 403 and does not touch the database.",
            "The system also uses idempotency to avoid duplicate sends. Every logical notification has an idempotency key, and the database enforces uniqueness on that key. If the same order event is processed twice, the code sees the duplicate and skips sending a second SMS.",
            "Unknown callbacks are handled safely. If Twilio sends a callback for a Message SID that does not exist in the database, the webhook logs a warning and still returns HTTP 200. This prevents needless retries from Twilio while still preserving an audit trail in logs.",
            "Returning HTTP 200 is important whenever the payload is valid enough to be acknowledged. Twilio treats non-200 responses as failures and may retry. In practical terms, a fast 200 response keeps the callback channel stable and reduces duplicate webhook traffic.",
        ],
    )
    bullet(story, styles, "Invalid signature: reject with 403")
    bullet(story, styles, "Unknown Message SID: log and return 200")
    bullet(story, styles, "Malformed but non-critical payload: ignore safely and return 200")
    bullet(story, styles, "Out-of-order statuses: normalized flow ignores backwards transitions")

    section_title(story, styles, "8. Reliability and Failure Handling")
    add_paragraphs(
        story,
        styles,
        [
            "The send path classifies Twilio failures as transient or permanent. That distinction matters because transient problems such as rate limits or upstream timeouts may succeed on retry, while permanent problems such as invalid or opted-out phone numbers usually will not.",
            "For SMS sends, the code can retry once on transient failures. If the failure is permanent on the primary phone number and a backup business alert number exists, the system can attempt delivery to that backup number. This is a practical business continuity measure.",
            "Traceability is built into both database rows and logs. Notification rows preserve status, timestamps, error codes, and provider IDs. Webhook handlers log invalid signatures, missing records, malformed payloads, and successful updates.",
            "Returning HTTP 200 for safely handled callback cases is intentional. It prevents Twilio from repeatedly retrying callbacks that are already understood and logged, such as unknown Message SIDs or non-critical malformed payloads.",
        ],
    )

    section_title(story, styles, "9. Environment Configuration")
    add_paragraphs(
        story,
        styles,
        [
            "In production, these values should be stored as server-side secrets, typically in Vercel environment settings for the Next.js application and in any worker environments that execute the same code. They should never be hard-coded into source files.",
            "The requested variable name <b>TWILIO_PHONE_NUMBER</b> is a common naming pattern, but the current codebase actually expects <b>TWILIO_FROM_NUMBER</b>. That naming difference matters because a mismatch would cause sends to fail at runtime.",
        ],
    )
    story.append(build_env_table())
    story.append(Spacer(1, 10))

    section_title(story, styles, "10. Example Walkthrough")
    add_paragraphs(
        story,
        styles,
        [
            "A realistic current example looks like this: a customer completes checkout, Stripe confirms payment, and YourBarrio creates a new order in the requested state. The notification pipeline creates a pending SMS row for the merchant’s alert phone number.",
            "The outgoing SMS body is similar to: <i>New order on YourBarrio: Order #YB-1001, $32.50 from Sarah. View: https://...</i>. Twilio accepts the request and returns a Message SID such as <i>SM123...</i>. The database stores that SID in provider_message_id.",
            "Later, Twilio sends message status callbacks. A typical progression is <i>queued</i> or <i>accepted</i>, then <i>sent</i>, then <i>delivered</i>. If the carrier rejects the message, the status can move to <i>failed</i> or <i>undelivered</i> instead.",
        ],
    )
    story.append(
        ascii_block(
            "Example timeline\n"
            "12:00:00  Order paid\n"
            "12:00:01  order_notifications row created (status=pending)\n"
            "12:00:02  Twilio send accepted, MessageSid=SM123\n"
            "12:00:05  Callback: MessageStatus=sent\n"
            "12:00:11  Callback: MessageStatus=delivered\n"
            "12:00:11  Database row updated with delivered timestamp"
        )
    )
    story.append(
        Paragraph(
            "If the business still does not acknowledge the order, the system can send one SMS reminder after 5 minutes and one email reminder after 15 minutes. Those reminders are tracked as separate rows in the same table.",
            styles["Callout"],
        )
    )

    section_title(story, styles, "11. Operational Notes")
    add_paragraphs(
        story,
        styles,
        [
            "A developer debugging this system would usually start in five places: <b>lib/integrations/twilio.ts</b> for provider calls, <b>lib/notifications/orders.ts</b> for orchestration, <b>app/api/twilio/status/route.ts</b> for webhook updates, the <b>order_notifications</b> table for ground truth, and the related unit tests for expected behavior.",
            "Common failure points include missing environment variables, invalid webhook signatures caused by callback URL mismatches, invalid or opted-out phone numbers, and duplicate or delayed upstream events. The presence of both application-level status fields and provider-level status fields helps narrow down where a failure actually occurred.",
            "For day-to-day operations, the highest-signal records are usually the Twilio Message SID, the notification row status, the provider error code, and the most recent timestamp showing when the provider last reported an event.",
        ],
    )
    bullet(story, styles, "High-value debug assets: order_notifications rows, Twilio SID, provider error fields, webhook logs")
    bullet(story, styles, "Reminder worker entry point: /api/internal/order-notification-reminders")
    bullet(story, styles, "Business order view also exposes notification history for operators")

    section_title(story, styles, "12. Future Improvements")
    add_paragraphs(
        story,
        styles,
        [
            "The current Twilio integration is a solid first operational alerting system, but several improvements would make it more robust and easier to scale.",
        ],
    )
    bullet(story, styles, "Push notifications for merchants using the web or mobile app, reducing dependence on SMS alone")
    bullet(story, styles, "Email fallback expansion so channel escalation is explicit and policy-driven")
    bullet(story, styles, "A notification operations dashboard showing volume, delivery rate, failure reasons, and acknowledgment times")
    bullet(story, styles, "Delivery ETA tracking and richer carrier analytics for support and merchant success teams")
    bullet(story, styles, "A dedicated retry worker with backoff, dead-letter handling, and alerting for prolonged Twilio failures")

    section_title(story, styles, "13. Conclusion")
    add_paragraphs(
        story,
        styles,
        [
            "From an architecture point of view, this system follows a sensible pattern: create a durable intent record first, hand delivery to a specialized provider, and then reconcile the final state through signed webhooks. That keeps the application simple while still giving operations and product teams visibility into what happened.",
            "For a reader new to the codebase, the main idea to remember is this: Supabase stores the truth about notification intent and history, Twilio performs the mobile delivery, and the Next.js backend connects the two with idempotent, auditable workflows.",
        ],
    )

    section_title(story, styles, "Appendix: Source Reference")
    add_paragraphs(
        story,
        styles,
        [
            "This PDF was written against the current repository layout. The files below are the main places to inspect when changing the Twilio notification system.",
        ],
    )
    story.append(build_source_table())

    return story


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawRightString(doc.pagesize[0] - 0.75 * inch, 0.55 * inch, f"Page {doc.page}")
    canvas.restoreState()


def generate_pdf(output_path: str = OUTPUT_PATH):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc = SimpleDocTemplate(
        output_path,
        pagesize=LETTER,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.8 * inch,
        title="YourBarrio Notification System – Twilio Integration",
        author="OpenAI Codex",
    )
    story = build_story()
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    return output_path


if __name__ == "__main__":
    path = generate_pdf()
    print(f"Generated PDF: {path}")
