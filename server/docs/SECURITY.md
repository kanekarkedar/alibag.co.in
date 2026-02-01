# Security & Data Safety Protocol 🔒

## 1. Authentication Strategy
The platform uses a tiered authentication model:
-   **Admins**: Multi-Factor Authentication (MFA) required. Hardcoded "Master Keys" are strictly for development.
-   **Owners**: OAuth 2.0 (Google/Apple) to remove the liability of storing password hashes.
-   **Guests**: Passwordless "Magic Links" or ephemeral sessions for low-friction booking.

## 2. Vulnerability Mitigation
We are actively mitigating the OWASP Top 10 vulnerabilities:

### A. Broken Object Level Authorization (BOLA)  🔴 *Critical*
**The Risk**: An owner changes the URL ID from `/hotels/5` to `/hotels/6` and edits someone else's hotel.
**The Fix**:
> Every database query includes the Owner ID check:
> `SELECT * FROM hotels WHERE id = ? AND owner_id = req.user.id`

### B. Injection Attacks
**The Risk**: SQL Injection login bypass.
**The Fix**:
> Usage of ORM (Prisma/Sequelize) which automatically parameterizes queries.
> `db.hotel.find({ where: { name: input } })` instead of raw SQL strings.

## 3. Data Storage & Privacy
-   **PII (Personally Identifiable Information)**: Guest names and emails are encrypted at rest using AES-256.
-   **financial Data**: We DO NOT store credit card numbers. We use Stripe Elements to tokenize cards client-side.
-   **Logs**: Server logs (Morgan) are stripped of sensitive data before storage.

## 4. WhatsApp Integration Safety
-   The daily poll data is associated with verified phone numbers only.
-   Rate limits prevent an attacker from flooding the poll endpoint.
