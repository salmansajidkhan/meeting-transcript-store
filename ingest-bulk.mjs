/**
 * Bulk ingestion script — loads all 6 months of transcript data into store.db
 * Run once: node ingest-bulk.mjs
 */
import { getDb, ingestMeeting } from "./db.mjs";

const meetings = [
  // ── September 2025 ──
  {
    meeting: {
      id: "2025-09-18-ea-macp-sync",
      title: "EA / MACP Sync",
      date: "2025-09-18",
      organizer: "Salman Khan",
      attendees: "Salman Khan, Mike (EA)",
      duration_minutes: 30,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "HVCI / HPCI dependency and attestation limitations. Microsoft's position that HVCI is a dependency for certain attestation guarantees. EA expressed strong dissatisfaction, explaining that HVCI does not meet EA's core need: understanding what drivers or kernel modifications were present before game launch, especially in cheating scenarios. Microsoft engineers were drafting a formal response." },
      { chunk_type: "discussion", content: "Security value trade-offs on HVCI-enabled systems. On systems where HVCI is enabled, many kernel-level cheat techniques (manual mapping, vulnerable drivers) are already mitigated, reducing the usefulness of additional attestation signals. Security features may deliver more value in less-secure or transitional environments than in already-hardened ones." },
      { chunk_type: "discussion", content: "ARM platform progress and Zero IT coordination. Updates on ongoing work with Zero IT to enable Thea on ARM. David from Zero IT would reach out directly to EA. EA confirmed ARM support is on their roadmap, but sequencing depends on near-term launches (e.g., Battlefield)." },
      { chunk_type: "discussion", content: "Secure Boot, TPM, and IOMMU adoption in gaming. EA shared early data showing strong uptake of Secure Boot driven by Battlefield requirements, with spillover effects across the gaming ecosystem. DMA/IOMMU protections require an industry-wide approach and cannot be solved by individual studios acting alone. Riot and EAC were cited as peers already pushing in this direction." },
      { chunk_type: "discussion", content: "User friction enabling HVCI on consumer systems. Systems blocked due to installed but unused incompatible drivers. Microsoft's HVCI readiness test referenced. Current UX makes it unrealistic to expect gamers to manually uninstall drivers. EA asked whether future Windows releases (e.g., 25H2) could make HVCI easier to enable or fail-safe." },
      { chunk_type: "action_item", content: "Salman Khan: Take EA's feedback on HVCI/HPCI usefulness back to the internal Microsoft engineering teams. Continue facilitating ARM coordination between EA and Zero IT." },
      { chunk_type: "action_item", content: "EA team: Revisit ARM enablement priority after upcoming launches. Continue evaluating HVCI adoption barriers and share additional data as available." },
    ],
  },

  // ── October 2025 ──
  {
    meeting: {
      id: "2025-10-20-secure-runtime-driver-report-wesp",
      title: "Secure Runtime Driver Report & WESP",
      date: "2025-10-20",
      organizer: "T. Lavoy",
      attendees: "Salman Khan, T. Lavoy, security team",
      duration_minutes: 45,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "WESP goals and scope: Moving security-sensitive third-party (and some first-party) drivers out of the Windows kernel, beginning with antivirus/endpoint protection and expanding to broader EDR scenarios." },
      { chunk_type: "discussion", content: "Anti-cheat vs. antivirus trust models: Antivirus trusts the OS/kernel, while anti-cheat considers the device owner/admin as the potential adversary. This drives distinct design requirements for attestation and monitoring." },
      { chunk_type: "discussion", content: "Runtime driver attestation design: How runtime attestation reports are produced leveraging VBS/HVCI, TPM, and secure kernel components to enumerate drivers loaded since boot, enabling partners to assess system integrity without unrestricted kernel access." },
      { chunk_type: "discussion", content: "Access control and certification: WESP's gated access model (capability declaration and signing requirements) compared with the more open nature of the runtime attestation API, prompting debate on how tightly anti-cheat vendors should be restricted." },
      { chunk_type: "discussion", content: "ELAM deprecation implications: Upcoming ELAM deprecation increases urgency to define a clear replacement path for early-boot visibility and trust signaling to third-party security vendors." },
      { chunk_type: "decision", content: "No final architectural decisions made. Further cross-team discussion required to determine how or whether runtime attestation APIs should formally become part of WESP." },
    ],
  },
  {
    meeting: {
      id: "2025-10-13-anticheat-isv-arm-biweekly",
      title: "Anticheat ISV Arm Updates Bi-Weekly",
      date: "2025-10-13",
      organizer: "Salman Khan",
      attendees: "Salman Khan, Jessica Sachs, Prashikh Agrawal",
      duration_minutes: 30,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "EA and Riot ARM anti-cheat status: EA's and Riot's hesitancy to commit engineering resources for ARM anti-cheat support, especially in light of EA's recent acquisition and shifting internal priorities." },
      { chunk_type: "discussion", content: "Zero IT engagement and bug tracking: Updates on Zero IT's ongoing work, newly discovered bugs, and coordination with CoreOS teams. Technical progress is outpacing firm customer commitments." },
      { chunk_type: "discussion", content: "Mihoyo / other partner logistics: Shipment of Surface loaner devices. Successful anti-cheat unblocking would have downstream benefits for additional studios (e.g., Crafton)." },
      { chunk_type: "discussion", content: "NetEase and kernel-mode anti-cheat: Reports that NetEase disabled kernel-mode anti-cheat on ARM. Paths to re-engage them through Microsoft's anti-cheat programs and NDA frameworks explored." },
      { chunk_type: "discussion", content: "Security posture of ARM / Copilot+ PCs: Built-in ARM security features (HVCI, secure-core PC defaults) and how driver attestation could enable more user-mode anti-cheat approaches over time." },
      { chunk_type: "discussion", content: "Risk tracking for ISVs: Activision and other partners flagged as increasing risk due to timeline slips and reprioritization." },
      { chunk_type: "discussion", content: "Live issues: Ongoing failures in Valorant China ARM testing and active follow-up with responsible teams." },
      { chunk_type: "action_item", content: "Engage Xbox SPM leadership to signal risk and urgency around EA/Riot ARM anti-cheat support. Continue Zero IT bug resolution and partner follow-ups. Track high-risk ISVs more visibly in internal status reporting." },
    ],
  },

  // ── December 2025 ──
  {
    meeting: {
      id: "2025-12-02-skillup-ai-code-mode",
      title: "SkillUp AI - Code Mode",
      date: "2025-12-02",
      organizer: "Stacey Mulcahy",
      attendees: "Salman Khan, Stacey Mulcahy, attendees",
      duration_minutes: 60,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "summary", content: "Live exploration of Spec Kit, a framework for structured, AI-assisted software development. Discussion of agentic and AI-steered development workflows. Comparison of different AI tools (Copilot, ChatGPT, Gemini, Claude) and guidance on which model is better for which task. Demonstration of turning vague ideas into structured specs, requirements, and implementation plans using AI agents. Emphasis on spec-first development to better steer AI outputs versus unstructured prompting." },
    ],
  },
  {
    meeting: {
      id: "2025-12-15-skillup-ai-holiday-maker",
      title: "SkillUp AI - Holiday Maker Studio",
      date: "2025-12-15",
      organizer: "Stacey Mulcahy",
      attendees: "Salman Khan, Stacey Mulcahy, attendees",
      duration_minutes: 60,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "summary", content: "Creative session focused on using generative AI for personal projects. Demonstration of image generation models, iterative prompting techniques, and printing/production guidance. Topics: custom labels, tiling patterns, stylized pet portraits, stickers. Practical guidance on turning AI images into physical gifts." },
    ],
  },
  {
    meeting: {
      id: "2025-12-16-skillup-ai-learning",
      title: "SkillUp AI - Unlock Your Learning Potential: How to Learn Faster with AI",
      date: "2025-12-16",
      organizer: "Alexandria Johnson",
      attendees: "Salman Khan, Alexandria Johnson, attendees",
      duration_minutes: 60,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "summary", content: "Structured instructional session on building personalized learning systems using Microsoft Copilot Notebooks. End-to-end walkthrough of Copilot Notebooks as a RAG-style constrained knowledge base. Techniques for knowledge validation: flashcards, practice exams, skill-mapped study plans. Comparison with Google NotebookLM, highlighting Copilot's advantage in enterprise data integration." },
    ],
  },

  // ── January 2026 ──
  {
    meeting: {
      id: "2026-01-23-dma-read-only-cheat-prevention",
      title: "DMA Read-Only Cheat Prevention Options",
      date: "2026-01-23",
      organizer: "Ethan Abeles",
      attendees: "Salman Khan, Ethan Abeles, Jason Wohlgemuth, Cody Hartwig",
      duration_minutes: 25,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "Mitigating DMA-based cheating attacks in PC games. Three strategies evaluated: (1) Full DMA remapping requirement - strong security but high compatibility risk with legacy drivers. (2) Topology-based partial enforcement - strict DMA remapping only on externally connected or higher-risk device paths. (3) Probabilistic pinning / nested translation approach (patent-pending) - maintain mapping model where only pinned memory is exposed to non-DMA-remapping devices." },
      { chunk_type: "discussion", content: "Differences between DMA pinning and other kernel pinning scenarios. Reliability of attacks under probabilistic defenses. Performance overhead and TLB behavior. Defense-in-depth with VBS, code integrity, read-only protections." },
      { chunk_type: "decision", content: "Treat the probabilistic pinning approach as the most promising balance of security, compatibility, and performance. Be cautious in partner disclosures due to ongoing patent work." },
      { chunk_type: "action_item", content: "Salman Khan: Work with Epic to collect driver compatibility data and extend data gathering to additional partners. Share pre-release Windows builds with trusted partners (Epic, Riot, possibly EA) for early validation." },
    ],
  },
  {
    meeting: {
      id: "2026-01-23-anticheat-attestation-vteam",
      title: "Windows Anti-cheat Attestation v-team",
      date: "2026-01-23",
      organizer: "Prashikh Agrawal",
      attendees: "Salman Khan, Prashikh Agrawal, v-team members",
      duration_minutes: 25,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "Windows anti-cheat attestation, DMA security gaps, and long-term platform strategy. Status of pre-production API documentation for anti-cheat attestation. Concerns about DMA remapping still allowing VTL0 memory exposure via non-DMA-capable devices." },
      { chunk_type: "discussion", content: "Reported ~40% performance penalty when enabling DMA remapping on GPU drivers, based on vendor feedback (NVIDIA, Intel). Strategic pivot discussed: shift focus from DMA-remapping-only mitigations toward software-isolated confidential VMs as a more robust, scalable long-term solution." },
      { chunk_type: "decision", content: "Leadership consensus favored confidential VMs over kernel-level mitigations due to performance and ecosystem realities. Confidential VMs better suited to protecting both CPU and GPU workloads compared to enclaves." },
      { chunk_type: "action_item", content: "Salman Khan: Sync with Kevin on DMA security standardization and partner implications. Review and provide feedback on pre-production API documentation. Validate GPU vendor performance data before broader commitments." },
    ],
  },
  {
    meeting: {
      id: "2026-01-26-anticheat-isv-arm-biweekly",
      title: "Anticheat ISV Arm Updates Bi-Weekly",
      date: "2026-01-26",
      organizer: "Salman Khan",
      attendees: "Salman Khan, Jessica Sachs, Prashikh Agrawal, Mindy",
      duration_minutes: 30,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "Zero IT tools: Thea is complete and unblocked. Griffin delayed, now targeting February 13, which affects EA's Javelin anti-cheat stack." },
      { chunk_type: "discussion", content: "Apex Legends: Migration from Easy Anti-Cheat to EA's Javelin is blocking immediate ARM enablement. EA committed to providing a plan shortly; ARM support expected this year but not yet confirmed." },
      { chunk_type: "discussion", content: "Riot / Vanguard: Preparations underway for a major February NVIDIA-Microsoft-Riot meeting to drive a decision." },
      { chunk_type: "discussion", content: "Tencent & NetEase: Device logistics (EV2.0, Cadmus) are the primary blocker, especially in China due to customs and labeling constraints. Delta Force and Arena Breakout Infinite remain top-priority titles with ongoing bugs." },
      { chunk_type: "decision", content: "Avoid duplicating work if EA's Javelin migration is imminent. Track ARM enablement progress on a per-studio basis due to heavy ACE customization at Tencent." },
      { chunk_type: "action_item", content: "Salman Khan: Follow up with EA on Apex Legends Javelin timeline. Update anti-cheat tracking tables with missing top titles. Coordinate with Mindy/Jessica on China device logistics and studio contacts." },
    ],
  },
  {
    meeting: {
      id: "2026-01-26-arm-gaming-fortnightly-rob",
      title: "Arm Gaming Fortnightly ROB",
      date: "2026-01-26",
      organizer: "Brynnan Fink",
      attendees: "Salman Khan, Brynnan Fink, Peter Dawoud, cross-org team",
      duration_minutes: 55,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "NVIDIA platform readiness: EV2 devices broadly deployed. LKG 123 shipped with thermal/power gains but blocked for ISVs due to a battery recovery bug. OEM devices (Lenovo, Asus) showing ~10% better performance than Surface." },
      { chunk_type: "discussion", content: "Qualcomm Heracles: Near end-game with embargo lifting in late February. Weekly engineering sync reinstated to accelerate bug triage." },
      { chunk_type: "discussion", content: "First-party studios & Xbox app: Xbox app reached GA with strong install growth. CERT now validating all incoming Xbox titles on ARM." },
      { chunk_type: "discussion", content: "Third-party studios & anti-cheat: EV1.5 and EV2 distribution status. Ongoing negotiations with Riot, EA, Tencent, NetEase. Salman provided anti-cheat status updates and telemetry insights." },
      { chunk_type: "action_item", content: "Salman Khan: Continue tracking top-10 anti-cheat titles (EA, Tencent). Update bug status with Rashif and partners. Align telemetry trends with engagement prioritization." },
    ],
  },

  // ── February 2026 ──
  {
    meeting: {
      id: "2026-02-04-denuvo-macp-monthly",
      title: "Denuvo / MACP Monthly Meeting",
      date: "2026-02-04",
      organizer: "Salman Khan",
      attendees: "Salman Khan, Palkesh (Denuvo), Denuvo team",
      duration_minutes: 25,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "Hot patch compatibility issues affecting Denuvo-protected games following the February Windows hot patch. Reproducible crashes in titles such as The Finals and Arc Raiders. Crash dumps showing involvement of the Denuvo anti-cheat update service and runtime DLLs." },
      { chunk_type: "discussion", content: "Cross-border file-sharing logistics. OneDrive agreed as interim solution. Debugging constraints including symbol mismatches and obfuscation. Alternative reproduction strategies: standalone anti-cheat binaries, test apps, VM-based testing." },
      { chunk_type: "discussion", content: "Broader architectural topics: risks of undocumented API usage (page-table walking), Partner Center verification failures affecting driver signing, emulator/Xbox runtime issues." },
      { chunk_type: "action_item", content: "Share crash dumps and hot-patch binaries via OneDrive. Test standalone Denuvo anti-cheat versions. Salman to engage Microsoft teams on undocumented API risks and partner notification mechanisms." },
    ],
  },
  {
    meeting: {
      id: "2026-02-04-salman-nick-1on1",
      title: "Salman / Nick 1:1",
      date: "2026-02-04",
      organizer: "Salman Khan",
      attendees: "Salman Khan, Nick Bassett",
      duration_minutes: 25,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "Strategic direction for the MACP program. Refining MACP's scope using survey data and a jobs-to-be-done framework. Emphasis on avoiding mission creep and defining clearer OKRs and KPIs." },
      { chunk_type: "discussion", content: "Secure Gaming Motherboard Program: OEM requirements, branding and marketing approvals, verification/audit language, tooling for gamer self-verification. Regional exceptions, future-proofing requirements, and potential adoption by game developers and anti-cheat systems." },
      { chunk_type: "action_item", content: "Schedule in-person security subset meeting. Draft OEM communication and Collaborate documentation. Coordinate with Kevin/Roger on gamer verification tooling. Engage marketing for branding approval." },
    ],
  },
  {
    meeting: {
      id: "2026-02-04-security-program-sync",
      title: "Security Program Sync",
      date: "2026-02-04",
      organizer: "Nick Bassett",
      attendees: "Salman Khan, Nick Bassett, security team",
      duration_minutes: 25,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "summary", content: "Schedule coordination, release dependencies, and internal tooling/process improvements. Upcoming in-person sessions. Release timelines for WSC and WESP reviewed, with consensus to prioritize quality over strict dates. Transitioning Teams chats to threaded format, mailbox cleanup, partner agreement updates, hybrid meeting challenges." },
    ],
  },
  {
    meeting: {
      id: "2026-02-04-arm-gaming-triage",
      title: "Arm Gaming Triage",
      date: "2026-02-04",
      organizer: "Prashikh Agrawal",
      attendees: "Salman Khan, Prashikh Agrawal, triage team",
      duration_minutes: 25,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "Game compatibility pass rates, dashboard reporting limitations, and anti-cheat classification issues for ARM platforms. BattleEye launch failures (first-launch only), manual recalculation of playable pass rates, inclusion of anti-cheat-blocked titles in reporting." },
      { chunk_type: "discussion", content: "Partner-specific bug prioritization (Heracles/Diabetes launches), emulation issues, QC driver timelines, publisher engagement (2K, Firaxis)." },
      { chunk_type: "action_item", content: "Shift reporting toward playable pass rate. Consolidate engagement and title-status trackers. Follow up with BattleEye and 2K on open issues." },
    ],
  },
  {
    meeting: {
      id: "2026-02-04-ea-anticheat-hvci",
      title: "EA Anti-Cheat HVCI Discussion",
      date: "2026-02-04",
      organizer: "Salman Khan",
      attendees: "Salman Khan, EA team",
      duration_minutes: 25,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "HVCI enablement challenges for EA titles. EA outlined adoption goals and friction caused by conservative compatibility checks. Microsoft engineering explained technical and UX constraints, including why registry-based enablement is not viable." },
      { chunk_type: "discussion", content: "Potential solutions: guarded YOLO enablement option, better diagnostics, improved help articles. No timelines committed." },
      { chunk_type: "action_item", content: "Investigate backlog items related to relaxed HVCI enablement. Improve help documentation and user guidance. Continue engineering discussions without timeline commitment." },
    ],
  },
  {
    meeting: {
      id: "2026-02-04-oem-sync-biweekly",
      title: "OEM Sync Evening - Bi-Weekly",
      date: "2026-02-04",
      organizer: "Paul Childress",
      attendees: "Salman Khan, Paul Childress, OEM partners",
      duration_minutes: 55,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "summary", content: "Windows 11 26H2 timelines, Smart App Control ECC limitations, Copilot feature rollouts, Auto SR testing, NPU driver requirements, and Windows ML migration. Salman contributed updates on Smart App Control ECC signing guidance and OEM expectations. OEMs advised to avoid ECC-signed binaries." },
    ],
  },
  {
    meeting: {
      id: "2026-02-05-wece-town-hall",
      title: "WECE Town Hall",
      date: "2026-02-05",
      organizer: "Robin Seiler",
      attendees: "Salman Khan, Robin Seiler, WECE org",
      duration_minutes: 60,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "summary", content: "K2 initiative goals, AI enablement strategy, server ecosystem priorities, telemetry and quality challenges, hybrid-work practices, and organizational culture signals. Leadership emphasized quality remediation before resuming aggressive feature expansion." },
    ],
  },
  {
    meeting: {
      id: "2026-02-09-anticheat-isv-arm-biweekly",
      title: "Anticheat ISV Arm Updates Bi-Weekly",
      date: "2026-02-09",
      organizer: "Salman Khan",
      attendees: "Salman Khan, team",
      duration_minutes: 25,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "Zero IT anti-cheat integration progress. Capcom/Denuvo issues. 2K ARM timelines. China device-shipping challenges. Civ 7 and NBA2K26 ARM commitments. Escalation paths for silent partners like Mihoyo." },
      { chunk_type: "action_item", content: "Research Zero IT studio dependencies. Continue Capcom and 2K follow-ups. Escalate device-shipping constraints." },
    ],
  },
  {
    meeting: {
      id: "2026-02-09-arm-gaming-fortnightly-rob",
      title: "Arm Gaming Fortnightly ROB",
      date: "2026-02-09",
      organizer: "Brynnan Fink",
      attendees: "Salman Khan, Brynnan Fink, cross-org team",
      duration_minutes: 55,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "summary", content: "EV2 device readiness, Qualcomm data-sharing constraints, ARM compatibility metrics, shipping barriers (especially China), and marketing planning for ARM devices. Salman reported partner ARM commitments and anti-cheat progress. Decision to share bug-only data with Qualcomm. Track countries with shipping barriers." },
    ],
  },
  {
    meeting: {
      id: "2026-02-04-nv-msft-gaming-workstream",
      title: "NV-MSFT Gaming Workstream",
      date: "2026-02-04",
      organizer: "Brynnan Fink",
      attendees: "Salman Khan, Brynnan Fink, NVIDIA team",
      duration_minutes: 25,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "EV2 device allocation, Fortnite emulation bugs, Zero IT tooling, Riot/EA timelines, developer outreach for DICE/GDC. Updates on Zero IT availability, EA/Riot integration paths, Embark engagement." },
      { chunk_type: "action_item", content: "Follow up with Epic, Neoho, Embark. Update top-100 title list. Coordinate Zero IT customer testing." },
    ],
  },

  // ── March 2026 ──
  {
    meeting: {
      id: "2026-03-04-denuvo-macp-monthly",
      title: "Denuvo / MACP Monthly Meeting",
      date: "2026-03-04",
      organizer: "Salman Khan",
      attendees: "Salman Khan, Denuvo team",
      duration_minutes: 22,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "X Game Runtime initialize bug: successfully reproduced and traced to a multiplayer networking API, with the appropriate internal team actively investigating." },
      { chunk_type: "discussion", content: "App Control for Business behavior: aggressive blocking of unsigned/self-signed binaries on fresh Windows installs. Enterprise policy intent clarified. Need to validate whether observed behavior is expected." },
      { chunk_type: "discussion", content: "Developer Mode certificate trust: concerns about a developer certificate installed when enabling developer mode. Agreed to investigate its trust level, intended usage, and policy implications." },
      { chunk_type: "discussion", content: "TPM requirements for Windows 11: in-depth discussion on TPM 2.0 requirements, QA validation processes, Secure Core PC tooling, and telemetry expectations." },
      { chunk_type: "action_item", content: "Check App Control behavior with the policy team. Clarify developer certificate trust and usage. Share official TPM requirement documentation and QA tools. Investigate Windows Update impact on Football Manager." },
    ],
  },
  {
    meeting: {
      id: "2026-03-04-salman-nick-1on1",
      title: "Salman / Nick 1:1",
      date: "2026-03-04",
      organizer: "Salman Khan",
      attendees: "Salman Khan, Nick Bassett",
      duration_minutes: 27,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "Device self-hosting issues: instability on Samsung and HP devices, Teams crashes, bug-filing practices." },
      { chunk_type: "discussion", content: "Project Frame Rate: Windows Store competitiveness versus Steam and structural challenges for developer adoption." },
      { chunk_type: "discussion", content: "Onboarding automation: two-pass documentation and automation strategy using markdown, scripts, and Outlook draft generation. Migration from PowerShell to Agent MCP model: replacing fragile PowerShell workflows with SQL stored procedures surfaced via MCP agents." },
      { chunk_type: "discussion", content: "EPSO skills and role-based agent access: modular agent design aligned to partner roles (MVI, MACP). MACP requirements & KPIs: begin formal requirements with SUVP partners and align OKRs/KPIs." },
      { chunk_type: "action_item", content: "Document onboarding flows in markdown. Coordinate policy-team discussion re: device/software decisions. Query Kusto for device-driver presence data. Begin MACP requirements formalization." },
    ],
  },
  {
    meeting: {
      id: "2026-03-04-security-program-sync",
      title: "Security Program Sync",
      date: "2026-03-04",
      organizer: "Nick Bassett",
      attendees: "Salman Khan, Nick Bassett, security team",
      duration_minutes: 26,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "Self-hosting setup failures: account creation and facial-recognition issues. Security training: test-out option and compliance expectations." },
      { chunk_type: "discussion", content: "Agent skills & private API docs: storing sensitive docs in source control vs. watermarked PDFs. Velocity flag deployment: March deadline unrealistic; April targeted." },
      { chunk_type: "discussion", content: "OKR/KPI alignment: NACP items integrated into updated OKRs. Compat testing requirement change: monthly testing requirement to replace previous within 7 days rule." },
      { chunk_type: "action_item", content: "Create aligned OKRs/KPIs. Update MVI one-pager. Fix partner contact-form failure. Update compat documentation." },
    ],
  },
  {
    meeting: {
      id: "2026-03-04-arm-gaming-triage",
      title: "Arm Gaming Triage",
      date: "2026-03-04",
      organizer: "Prashikh Agrawal",
      attendees: "Salman Khan, Prashikh Agrawal, triage team",
      duration_minutes: 26,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "Games on Arm dashboard structure, categories, and triage workflow. Platform-specific regressions: Fortnite audio, RDR2, Delta Force." },
      { chunk_type: "discussion", content: "Anti-cheat ownership clarity and partner engagement. Borderlands patch tracking and emulation issues. Xbox Test X vs. self-host data integration." },
      { chunk_type: "action_item", content: "Follow up with Xbox studios on Borderlands patch timing. Confirm device delivery to partners. Maintain dashboard data quality and ownership." },
    ],
  },
  {
    meeting: {
      id: "2026-03-04-nv-msft-gaming-workstream",
      title: "NV-MSFT Gaming Workstream",
      date: "2026-03-04",
      organizer: "Brynnan Fink",
      attendees: "Salman Khan, Brynnan Fink, NVIDIA team",
      duration_minutes: 29,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "EA and Activision anti-cheat timelines. Need for firm dates to drive partner urgency. Device allocation constraints (EV2, Snapdragon). Tencent, Riot, Mihoyo engagement strategies." },
      { chunk_type: "discussion", content: "Proxy device performance testing. GDC coordination and coverage." },
      { chunk_type: "action_item", content: "Propose internal EA unblock date. Coordinate studio device shipments. Continue ARM gaming exec updates post-GDC." },
    ],
  },
  {
    meeting: {
      id: "2026-03-09-anticheat-isv-arm-biweekly",
      title: "Anticheat ISV Arm Updates Bi-Weekly",
      date: "2026-03-09",
      organizer: "Salman Khan",
      attendees: "Salman Khan, Brynnan Fink, Jessica Sachs, team",
      duration_minutes: 31,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "Riot and Activision executive engagement status post-GDC. Riot follow-ups and continued waiting on Activision amid Xbox leadership changes." },
      { chunk_type: "discussion", content: "Zero IT anti-cheat integration: bug fix that unblocked re-engagement with Embark. Clarified partner status for Riot, EA, and Embark." },
      { chunk_type: "discussion", content: "Tracker consolidation: named DRIs over teams, clearer status signals, alignment between studio-driven and title-driven tracking. Responsibilities between Salman and Jessica clarified." },
      { chunk_type: "decision", content: "Shift to named DRIs (not teams). Use Power BI dashboard as leadership source of truth." },
      { chunk_type: "action_item", content: "Update anti-cheat dependency tracker to make statuses more actionable. Align top-200 games tracker with Power BI dashboard." },
    ],
  },
  {
    meeting: {
      id: "2026-03-09-wece-fhl-demos",
      title: "WECE FHL Demos (26') - Session 1",
      date: "2026-03-09",
      organizer: "Robin Seiler",
      attendees: "Salman Khan, Robin Seiler, WECE org",
      duration_minutes: 45,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "discussion", content: "Multiple teams demonstrated Copilot-, Claude-, and MCP-based tooling for product management, customer risk identification, meeting prep automation, and partner engagement." },
      { chunk_type: "discussion", content: "Salman presented an automation of the MVI partner onboarding process, reducing a 19-step manual workflow into a single-command Copilot CLI flow, plus an expert-finder agent to identify SMEs by topic." },
      { chunk_type: "discussion", content: "Other demos: AI-assisted logging standardization, plugin-based MCP tooling, automated partner communications, ML-driven notification analysis, and hybrid local/cloud document intelligence." },
      { chunk_type: "summary", content: "Emphasis on speed of iteration, reduction of manual effort, and scalable AI agents embedded into daily workflows." },
    ],
  },

  // ── February 2026 additional (EA/MACP Sync from the Feb 19 recording) ──
  {
    meeting: {
      id: "2026-02-19-ea-macp-sync",
      title: "EA / MACP Sync",
      date: "2026-02-19",
      organizer: "Salman Khan",
      attendees: "Salman Khan, EA team",
      duration_minutes: 30,
      is_transcribed: 1,
    },
    chunks: [
      { chunk_type: "summary", content: "EA/MACP sync meeting. Continuation of discussions on HVCI, attestation, ARM anti-cheat enablement, and EA's roadmap for ARM support. Follow-up from September 2025 EA/MACP sync." },
    ],
  },
];

// ── Run ingestion ──
const db = getDb();
let count = 0;
for (const { meeting, chunks } of meetings) {
  ingestMeeting(db, meeting, chunks);
  count++;
  process.stdout.write(`\r  Ingested ${count}/${meetings.length}: ${meeting.title}`);
}
db.close();
console.log(`\n\n✅ Ingested ${count} meetings into store.db`);
