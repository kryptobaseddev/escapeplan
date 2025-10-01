# EscapePlan Monetization Strategy (Draft v0.1)

## 1. Purpose & Scope
- Define a profitable, operator-friendly pricing framework for EscapePlan, covering local licensing, support renewals, optional cloud services, hardware bundles, and professional services.
- Align monetization with the MVP differentiators documented in `project-docs/project-overview.md` and establish guardrails for future roadmap-driven upsells (multi-site analytics, CRM, etc.).

## 2. Target Customer Profiles
- **Independent Escape Room (1–2 rooms):** Owner-operators prioritizing reliability and low ongoing costs; likely to self-host on a Raspberry Pi.
- **Mid-Sized Venue (3–6 rooms):** Multi-room facilities with part-time staff; high sensitivity to downtime and staff ramp-up processes.
- **Mobile Escape Experience Provider:** Delivers pop-up games at corporate or educational events; needs offline sync, logistics tracking, and quick setup on varied hardware.
- **Emerging Multi-Site Brand:** Planning expansion to multiple locations; values centralized oversight and analytics, opening the door to the cloud control add-on.

## 3. Value Proposition Recap
- **Offline-first Appliance:** Private Wi-Fi network, Pi-optimized stack, and camera orchestration remove dependency on commercial internet (project-overview.md:17, 69).
- **Unified Booking → Session Workflow:** Integrated pricing tiers, deposits, session states, hint logging, and live camera tiles reduce operator tool sprawl (project-overview.md:460, 704).
- **Mobile Operations Tooling:** `is_mobile` flag, offline sync queues, printable run sheets uniquely serve traveling escape kits (project-overview.md:76).
- **Roadmap Credibility:** Multi-site analytics, ONVIF discovery, and CRM integration already outlined, supporting phased upgrades (project-overview.md:732).

## 4. Competitive Pricing Benchmarks (2025 snapshot)
- **Escape Room Master:** $69/mo for "Game Master" suite; yearly discount 10%; optional modules (waivers, leaderboards) layered on top. Source: escaperoommaster.com/pricing.
- **Houdini Master Control:** Lifetime licenses at €150 (1), €300 (3), €500 (6) with lifetime updates; largely desktop-first and cloud-dependent for analytics. Source: houdinimc.com/pricing-3-column/.
- **OffTheCouch:** Bundled CRM + marketing automation; SaaS subscription reportedly >$120/mo per venue; requires always-on internet.
- **Escape Room Admin:** Budget SaaS at ~$49/mo but minimal camera integration.
- **ClueMaster:** Timer-centric tool ≈$40/mo; lacks booking flow and offline support.

**Takeaway:** Operators either pay ongoing SaaS (>$800/year for core bookings) or buy perpetual software with limited hardware/mobile support. EscapePlan can command a premium upfront fee by bundling reliability, mobile features, and offline-first design while keeping total cost of ownership below a 24-month SaaS bill.

## 5. Monetization Components

### 5.1 Local License (On-Premise Core)
| Tier | Inclusions | Price (USD) | Notes |
| --- | --- | --- | --- |
| **Starter (up to 4 rooms, 1 install)** | Perpetual software license, Raspberry Pi deployment toolkit, booking + game runner modules, camera control, first-year updates/support | **$1,295** | Equivalent to ~18 months of $69/mo SaaS spend; positions as "buy once, own forever".
| **Expansion Pack** | Adds up to 4 additional rooms on same site; inherits support term | **$350** | Allows scaling without buying new base license.
| **Multi-Site Add-On** | Adds second appliance under same owner (up to 12 rooms total) | **+$600** when purchased with Starter | Use to convert growing brands before cloud upsell.

**Pricing Rationale:**
- Hardware-agnostic yet optimized for Pi (project-overview.md:20) reduces vendor lock-in anxiety.
- Operators view $1.3k upfront as capex offsetting recurring SaaS annuities.
- Expansion pricing nudges larger venues toward support renewals and future cloud subscriptions.

### 5.2 Support & Update Renewals
| Plan | Coverage | Annual Fee | SLA |
| --- | --- | --- | --- |
| **Standard** | Security patches, feature updates, ticket-based support (2 business day response), knowledge base access | 22% of active license value (e.g., $285 for Starter) | 2-day response, 2 included remote sessions/year |
| **Priority (requires Cloud Control)** | All Standard benefits plus next-business-day response, proactive health reviews, designated success channel | Standard fee + $49/mo/site | Offset higher support load with recurring revenue.

**Policies:**
- Renewals optional but required for updates beyond initial year; re-entry fee = 30% surcharge if lapsed >90 days.
- Tie major roadmap features (0.3.0+, multi-site analytics) to active support to reinforce renewals.

### 5.3 Cloud Control Subscription (Optional)
| Component | Price (USD) | Description |
| --- | --- | --- |
| **Base Subscription** | $129/mo (covers first appliance) | Cloud sync for bookings/sessions, remote dashboards, nightly off-site backups, priority ticket routing. |
| **Additional Appliance** | +$35/mo each | Allows multiple Pi installs under a single account with centralized control. |
| **Premium Support Upgrade** | +$49/mo | 24/7 on-call escalation, quarterly system health review, tailored upgrade scheduling. |

**Differentiators:**
- Maintains offline-first positioning while offering disaster recovery and centralized control for multi-site brands.
- Creates recurring revenue stream balancing upfront flat-fee model.
- Supports upsell path toward roadmap items (multi-location analytics, OTA updates).

### 5.4 Hardware & Deployment Services
| Offer | Price (USD) | Margin Notes |
| --- | --- | --- |
| **EscapePlan Hardware Kit** | $449 | Includes Pi 5, case, SD card (imaged), PSU, PoE splitter, mounts. Estimated COGS ~$240. |
| **PoE Camera Starter Bundle** | $799 | 2 ONVIF cameras + cabling + PoE switch; negotiated with supplier for 30% margin. |
| **Remote White-Glove Setup** | $699 | Covers database seeding, role provisioning, camera pipeline validation. 6-hour service block. |
| **On-Site Launch Day** | $1,999 + travel | Full-day operator training, hardware placement, network tuning. |
| **Staff Certification (per person)** | $149 | Self-paced LMS covering Game Runner, booking flow, emergency procedures. |

Hardware/services bolster cash flow during early releases and provide touchpoints that reduce churn risk.

### 5.5 Content & Marketplace (Phase 2+)
- Puzzle/hint content packs aligned to popular themes (heist, sci-fi, horror): $99–$199 each.
- Seasonal marketing assets (social templates, signage) bundled at $79/season.
- Branded mobile kit checklists and logistics templates for event operators ($49/download).

## 6. Financial Modeling Assumptions
- **COGS (software):** Negligible per install; allocate $80/year/operator for support labor in Standard tier.
- **Support Labor:** Target 1 support engineer per 75 active licenses; Standard SLA aims for <4 hours per ticket.
- **Cloud Infrastructure:** $10/mo baseline per tenant (object storage, VPN tunnel, monitoring); margin intact at $129/mo pricing.
- **Hardware Kit:** Maintain 45–50% gross margin; adjust price quarterly with Pi supply volatility.
- **Attach Rates (Year 1 goals):** 70% renewal uptake, 35% Cloud Control adoption among venues with >4 rooms, 50% of new installs purchase hardware kit, 25% buy remote setup.

## 7. Pricing Rollout Plan
1. **Pilot Validation (Q1):** Offer discounted founder package ($999 Starter, $199 support) to 3 pilot venues in exchange for references and UAT feedback.
2. **Support Playbooks:** Finalize runbooks for Tier 1/Tier 2 support, including hardware diagnostics and ffmpeg pipeline recovery.
3. **Contract Templates:** Draft master license agreement, support T&Cs, and cloud subscription order form; align with compliance requirements in project overview.
4. **Billing & Fulfillment:** Integrate Stripe or Paddle for license + support invoicing; maintain manual option (ACH) for smaller operators.
5. **Marketing Collateral:** Build ROI calculator (SaaS vs EscapePlan), produce demo video highlighting offline reliability and mobile kit support.
6. **Channel Partnerships:** Approach escape room consultants and Pi hardware resellers for referral agreements (10% commission on Starter licenses).

## 8. Metrics & Review Cadence
- **Quarterly:** Track new licenses sold, renewal % (booked vs up for renewal), net cloud ARR, average support resolution time.
- **Monthly:** Monitor cloud usage costs, NPS, ticket volume per customer segment, hardware kit margin.
- **Annual:** Revisit pricing vs competitive landscape, adjust support fee % if roadmap costs rise, evaluate marketplace contribution.

## 9. Risk Mitigation
- **Support Overrun:** Cap Standard SLA commitments; route high-touch customers toward Priority support to fund additional staffing.
- **Piracy / Unauthorized Installs:** Tie license activation to hardware fingerprint + offline grace mode; audit during support renewals.
- **Hardware Supply Volatility:** Keep kit optional; maintain 60-day buffer inventory; provide vetted sourcing guide for DIY customers.
- **Cloud Liability:** Default to offline mode; clarify that cloud downtime does not impact local operations; offer SLA credits for extended outages.

## 10. Next Steps & Owner Assignments
| Task | Owner | Target Date |
| --- | --- | --- |
| Validate pricing sensitivity with pilot operators (survey + interviews) | Product Lead | April 15 |
| Define support playbooks and staffing plan | Operations Lead | April 30 |
| Draft license + support agreement templates | Legal/Finance | May 7 |
| Build billing + license key tooling | Engineering | May 15 |
| Prepare marketing site pricing page + collateral | Marketing | May 20 |
| Plan public launch announcement & partner outreach | GTM Team | June 1 |

---
**Document Status:** Draft v0.1 — feedback welcome before finalizing for pilot launch.
