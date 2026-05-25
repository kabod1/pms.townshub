import { Link } from 'react-router-dom'
import { ArrowLeft, Shield } from 'lucide-react'

const LAST_UPDATED = '25 May 2025'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-light">
      {/* Header */}
      <div className="bg-navy text-white">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <Shield size={22} className="text-gold" />
            <span className="text-lg font-bold">TownsHub PMS</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-subtext hover:text-body mb-6"
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        <h1 className="text-2xl font-bold text-body mb-1">Privacy Policy</h1>
        <p className="text-sm text-subtext mb-8">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-sm max-w-none space-y-8 text-body">

          <section>
            <h2 className="text-base font-semibold mb-2">1. Data Controller</h2>
            <p className="text-sm text-subtext leading-relaxed">
              TownsHub LLC ("we", "us", "our") is the data controller for personal data processed
              through TownsHub PMS. Contact us at{' '}
              <a href="mailto:privacy@townshub.cy" className="text-gold">privacy@townshub.cy</a>{' '}
              for any data-related enquiries.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">2. What Personal Data We Collect</h2>
            <div className="space-y-3 text-sm text-subtext leading-relaxed">
              <div>
                <p className="font-medium text-body">Guest data (collected by hotels using the platform):</p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>Name, email address, phone number</li>
                  <li>Nationality, date of birth</li>
                  <li>Passport / national ID number and type</li>
                  <li>Home address (street, city, country, postal code)</li>
                  <li>Company name (if applicable)</li>
                  <li>Booking history, payment amounts, special requests</li>
                  <li>Marketing consent status and date</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-body">Platform user data (hotel staff accounts):</p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>Name, work email address, role</li>
                  <li>Login timestamps and session data</li>
                  <li>Pages visited within the platform (anonymous analytics)</li>
                  <li>IP address, browser type, device type</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">3. Legal Basis for Processing</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-mid">
                  <th className="text-left py-2 pr-4 font-medium text-body">Processing activity</th>
                  <th className="text-left py-2 font-medium text-body">Legal basis (GDPR Art. 6)</th>
                </tr>
              </thead>
              <tbody className="text-subtext">
                {[
                  ['Guest booking management', 'Contract performance (Art. 6(1)(b))'],
                  ['Identity verification (passport/ID)', 'Legal obligation (Art. 6(1)(c)) — local hotel registration laws'],
                  ['Invoicing & financial records', 'Legal obligation (Art. 6(1)(c)) — EU tax/accounting requirements'],
                  ['Marketing communications', 'Consent (Art. 6(1)(a)) — opt-in only'],
                  ['Platform usage analytics', 'Legitimate interest (Art. 6(1)(f)) — improving service quality'],
                  ['Push notifications', 'Consent (Art. 6(1)(a)) — explicit browser permission'],
                ].map(([activity, basis]) => (
                  <tr key={activity} className="border-b border-mid/50">
                    <td className="py-2 pr-4">{activity}</td>
                    <td className="py-2">{basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">4. Data Retention</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-mid">
                  <th className="text-left py-2 pr-4 font-medium text-body">Data category</th>
                  <th className="text-left py-2 font-medium text-body">Retention period</th>
                </tr>
              </thead>
              <tbody className="text-subtext">
                {[
                  ['Financial records (invoices, payment amounts)', '7 years — EU accounting obligation'],
                  ['Booking records', '7 years — EU accounting obligation'],
                  ['Guest personal profiles', 'Until deletion requested, or 7 years from last stay'],
                  ['Platform usage / page view logs', '12 months'],
                  ['Push notification subscriptions', 'Until unsubscribed or account deleted'],
                  ['Marketing consent records', 'For the duration of consent plus 3 years (audit trail)'],
                ].map(([category, period]) => (
                  <tr key={category} className="border-b border-mid/50">
                    <td className="py-2 pr-4">{category}</td>
                    <td className="py-2">{period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">5. Data Processors (Sub-processors)</h2>
            <p className="text-sm text-subtext mb-3 leading-relaxed">
              We share data with the following service providers who process it on our behalf under
              Data Processing Agreements:
            </p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-mid">
                  <th className="text-left py-2 pr-4 font-medium text-body">Processor</th>
                  <th className="text-left py-2 pr-4 font-medium text-body">Purpose</th>
                  <th className="text-left py-2 font-medium text-body">Location</th>
                </tr>
              </thead>
              <tbody className="text-subtext">
                {[
                  ['Supabase Inc.', 'Database, authentication, storage', 'EU (Frankfurt, AWS)'],
                  ['Vercel Inc.', 'Application hosting & CDN', 'Global (Edge Network)'],
                  ['Stripe Inc.', 'Payment processing', 'EU / USA'],
                  ['SiteMinder', 'OTA channel management', 'Australia / EU'],
                  ['Resend / SendGrid', 'Transactional email delivery', 'USA (SCCs apply)'],
                ].map(([name, purpose, location]) => (
                  <tr key={name} className="border-b border-mid/50">
                    <td className="py-2 pr-4 font-medium text-body">{name}</td>
                    <td className="py-2 pr-4">{purpose}</td>
                    <td className="py-2">{location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-subtext mt-2">
              SCCs = EU Standard Contractual Clauses (adequate safeguard for US transfers).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">6. Cookies & Tracking</h2>
            <p className="text-sm text-subtext leading-relaxed">
              We use <strong>no advertising cookies</strong> and <strong>no third-party trackers</strong>.
              We set one functional cookie (<code>townshub_cookie_consent</code>) to remember your
              consent choice. If you accept analytics, we record anonymous page views (path, browser,
              device type, country) using our own first-party system — no data is sent to Google Analytics
              or similar services.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">7. Your Rights Under GDPR</h2>
            <ul className="text-sm text-subtext space-y-2 leading-relaxed">
              {[
                ['Access (Art. 15)', 'Request a copy of all personal data we hold about you.'],
                ['Rectification (Art. 16)', 'Correct inaccurate or incomplete personal data.'],
                ['Erasure (Art. 17)', 'Request deletion of personal data ("Right to be Forgotten"). Note: financial records may be retained under legal obligation.'],
                ['Restriction (Art. 18)', 'Request we restrict processing of your data.'],
                ['Portability (Art. 20)', 'Receive your data in a machine-readable format (JSON export available).'],
                ['Objection (Art. 21)', 'Object to processing based on legitimate interest, including marketing.'],
                ['Withdraw consent (Art. 7)', 'Withdraw consent for marketing or analytics at any time without penalty.'],
              ].map(([right, desc]) => (
                <li key={right as string} className="flex gap-2">
                  <span className="font-medium text-body shrink-0">{right}:</span>
                  <span>{desc}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-subtext mt-3 leading-relaxed">
              To exercise any right, email{' '}
              <a href="mailto:privacy@townshub.cy" className="text-gold">privacy@townshub.cy</a>.
              We will respond within 30 days. You also have the right to lodge a complaint with your
              local supervisory authority (e.g. the Cyprus Commissioner for Personal Data Protection
              at <a href="https://www.dataprotection.gov.cy" target="_blank" rel="noopener noreferrer" className="text-gold">dataprotection.gov.cy</a>).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">8. Security</h2>
            <p className="text-sm text-subtext leading-relaxed">
              All data is encrypted in transit (TLS 1.2+). Data at rest is encrypted by Supabase
              (AES-256 via AWS RDS). We enforce strict row-level security so each hotel can only
              access their own tenant's data. Administrative access is protected by multi-factor
              authentication. Security headers (HSTS, CSP, X-Frame-Options) are applied to all
              responses.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">9. Changes to This Policy</h2>
            <p className="text-sm text-subtext leading-relaxed">
              We may update this policy to reflect changes in our practices or legal requirements.
              The "Last updated" date at the top will change, and significant changes will be notified
              to hotel account holders by email.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">10. Contact</h2>
            <p className="text-sm text-subtext leading-relaxed">
              TownsHub LLC<br />
              Data Protection enquiries:{' '}
              <a href="mailto:privacy@townshub.cy" className="text-gold">privacy@townshub.cy</a>
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
