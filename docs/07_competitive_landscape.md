<div align="center">

# 🥊 Competitive Landscape

**Who else is in this space, what they actually do, and where ReliefOS fits**

[⬅ Back to README](../README.md)

![Verified](https://img.shields.io/badge/Descriptions-checked_against_official_pages-2ea44f)
![Honest](https://img.shields.io/badge/Rule-never_say_%22nobody_has_done_this%22-d9381e)

</div>

> **Bottom line.** Pieces of ReliefOS exist in other tools: crisis mapping, inventory, request tracking, government registries. **No tool we found combines AI intake of messy reports with urgency-and-distance-aware recommendations of what should move where.** That combination is our claim, and it is a narrower claim than "nobody does this". Say it that way.

*Checked on 17 Oct 2026 against each tool's own page or a reputable summary. Features can change, so re-check anything you put on a slide.*

---

## 🗺️ At a glance

| Tool | Who runs it | Core job | Overlap with us | Threat |
|---|---|---|---|---|
| 🟧 **Sahana Eden** | Sahana Software Foundation (open source) | Full disaster-management suite | **High**: inventory, shelters, *requests matched to sources* | 🔴 High |
| 🟦 **IDRN** | NIDM, Ministry of Home Affairs, hosted by NIC | National registry of equipment, personnel, supplies | Medium: supply side only, government-only access | 🟠 Medium |
| 🟪 **Crisis Cleanup** | Open-source, volunteer orgs | Shared map of cleanup requests that groups can claim | Medium: request board and claiming | 🟠 Medium |
| 🟩 **Logistics Cluster tools** | UN logistics coordination | Logistics info, maps, service requests for responders | Medium: large-agency logistics, offline app | 🟠 Medium |
| 🟥 **IFRC GO** | IFRC | Emergency operations data and dashboards | Low: situational awareness | 🟢 Low |
| 🟨 **Ushahidi** | Ushahidi (non-profit) | Incident reports by SMS, email, web, plotted on a map | Low: reporting and mapping only | 🟢 Low |
| ⬜ **WhatsApp / Telegram groups** | Everyone | What people actually use | The real incumbent | 🔴 High (in practice) |

---

## 🔍 One by one

### 🟧 Sahana Eden: closest competitor, know it well
- **What it is:** free, open-source humanitarian platform for disaster management, supported by the Sahana Software Foundation.
- **Modules that overlap:** Inventory Management (receive, send, manage items), Shelter Registry (locations, capacity, distribution of victims), **Requests Management (tracks requests for items and matches them to sources)**, plus volunteer management and missing-persons registry.
- **Where it stops (our read, to verify by trying the demo):** form-driven data entry, so someone must key in structured requests. No documented AI extraction from free text or photos, and no documented urgency-and-distance ranking with transport capacity.
- **How to answer a judge:** *"Sahana is excellent as a registry and request tracker. ReliefOS is the intake and decision layer: it understands a Hindi voice-note-style message, ranks what should move, and could sit on top of such systems."* Do **not** claim Sahana lacks matching.
- **Source:** [Sahana Eden overview](https://entrega-elp.readthedocs.io/en/latest/pages/whatis.html)

### 🟦 IDRN: India Disaster Resource Network
- **What it is:** a nationwide electronic inventory of emergency response resources: equipment, skilled personnel and critical supplies, compiled from districts, states and national departments.
- **Run by:** National Institute of Disaster Management (NIDM, Ministry of Home Affairs), hosted at NIC.
- **Purpose:** helps government decision-makers check whether equipment and personnel are available and assess preparedness.
- **Access:** limited to authorised government officers. District Collectors oversee data collection.
- **Gap for us:** a registry for government use. It lists what exists, not live demand from camps, and NGOs and donors do not see it.
- **Our angle:** IDRN is a possible **data source** for supply, not a rival. Say "we complement IDRN".
- **Source:** [IDRN overview (idrn.nidm.gov.in)](https://idrn.nidm.gov.in/About/)

### 🟪 Crisis Cleanup
- **What it is:** free, open-source mapping tool for volunteer relief organisations. Each resident's need is entered via an assessment form and shown as an icon on a shared map. Any participating organisation can **claim** a request and update its status so others do not duplicate work.
- **Track record:** an early article reports 30,000+ volunteers from 100 organisations connected with about 8,000 families since 2012, used in Hurricane Sandy, Colorado wildfires and tornadoes.
- **Gap for us:** it coordinates *work orders* (cleanup, tree removal, food delivery) between organisations, rather than moving bulk supplies between depots and camps with quantities, distances and vehicles.
- **Steal this idea:** the "claim and status" mechanic is great UX. Our approve/dispatch flow can mirror it.
- **Source:** [GovTech on Crisis Cleanup](https://www.govtech.com/em/disaster/Crisis-Cleanup-Mapping-Tool.html)

### 🟩 Logistics Cluster tools ("Cluster on the Go")
- **What it is:** a mobile app giving responders real-time alerts, interactive logistics maps (from the LogIE platform), a field toolkit, **service requests**, reporting and offline access.
- **Gap for us:** built for the large-agency humanitarian system. It gives information and services, and does not appear to auto-match local supply to camp demand for small NGOs and donors.
- **Our angle:** the offline-capable design validates our offline story.
- **Source:** [Logistics Cluster app](https://logcluster.org/en/what-we-do/emergency-response/mobile-app)

### 🟥 IFRC GO
- **What it is:** the IFRC's emergency operations platform for capturing, analysing and sharing real-time data during a crisis, with reports, maps and dashboards. Public access.
- **Gap for us:** situational awareness and reporting, not supply-demand matching.
- **Source:** [IFRC GO](https://www.ifrc.org/ifrc-go)

### 🟨 Ushahidi
- **What it is:** lets people report incidents by SMS, email or web form; reports are plotted on a map with a description.
- **Gap for us:** collects and visualises reports. No inventory, no matching, no transport planning.
- **Our angle:** same intake idea, but we *structure* the report and act on it.
- **Source:** [IJNet on Ushahidi](https://ijnet.org/en/story/online-tool-allows-citizens-crisis-bear-witness-report-news)

### ⬜ WhatsApp and Telegram groups, the real competitor
- This is what people use today. Evidence: civil society groups created **Telegram channels to coordinate relief supplies** during Pakistan's 2025 floods, and in Punjab 2025 faith-based networks ran relief in parallel with the state.
- **Why it fails:** no structure, no stock tracking, no prioritisation, no audit trail.
- **Our pitch:** we do not replace the chat group. We **read it**, structure it, and give back a plan.

---

## 🧩 Feature comparison

✅ = documented in what we checked · ➖ = partial / not documented · ❌ = not in scope

| Capability | ReliefOS | Sahana Eden | IDRN | Crisis Cleanup | Logistics Cluster | Ushahidi |
|---|---|---|---|---|---|---|
| Reports on a map | ✅ | ✅ | ➖ | ✅ | ✅ | ✅ |
| Inventory / stock | ✅ | ✅ | ✅ | ❌ | ➖ | ❌ |
| Requests tracking | ✅ | ✅ | ❌ | ✅ | ✅ | ➖ |
| Matches requests to sources | ✅ | ✅ | ❌ | ➖ (claiming) | ➖ | ❌ |
| **AI reads messy text / photos** | ✅ | ➖ | ❌ | ❌ | ❌ | ❌ |
| **Ranks by urgency + distance + vehicle capacity** | ✅ | ➖ | ❌ | ❌ | ➖ | ❌ |
| **Explains why (score breakdown)** | ✅ | ➖ | ❌ | ❌ | ❌ | ❌ |
| Open to NGOs / donors | ✅ | ✅ | ❌ (govt only) | ✅ | ➖ | ✅ |
| Offline | ➖ (planned) | ➖ | ❌ | ❌ | ✅ | ➖ |

⚠️ The ➖ cells for Sahana are *"not documented in what we read"*, not *"proven absent"*. Install the Sahana demo or read its docs before the final pitch.

---

## 🎯 Our positioning

**One line for slides:**
> *Others map the crisis or register resources. ReliefOS reads the messy report, finds the stock, and tells you what to move where.*

**Three differentiators to repeat:**
1. 🤖 **AI intake**: calls, texts and photos become structured demand, with confidence scores and human review.
2. ⚖️ **Decision engine**: urgency, distance and truck capacity ranked together, with a visible "why".
3. 🤝 **One shared layer**: government, NGOs, CSR and donors see the same picture.

**Where we deliberately do not compete:** victim registries, volunteer rosters, early warning, forecasting. We integrate with them.

---

## ❓ Judge questions about competitors

| Question | Answer |
|---|---|
| *"Doesn't Sahana already match requests to sources?"* | "Yes, as a registry. We add the intake and the decision: AI reads unstructured reports and we rank moves by urgency, distance and capacity. We could feed a Sahana-style system." |
| *"Why not use IDRN?"* | "IDRN is for government officers and lists resources. Camps' live demand and NGO stock are not in it. We would use IDRN as a supply source." |
| *"Why not just WhatsApp?"* | "That is where the data is. We read the chat, structure it, and give back a plan with an audit trail." |
| *"Is this novel?"* | "The parts exist. The combination of AI intake and explainable, capacity-aware recommendations for local relief is what we are building and testing." |

---

## ✅ Still to verify

- [ ] Try the Sahana Eden demo: does Requests Management rank by urgency or distance?
- [ ] Any Indian startups or NDMA digital platforms doing relief matching (search again close to the event)
- [ ] Current Ushahidi status and pricing
- [ ] Whether Google or Microsoft disaster tools have matching features
