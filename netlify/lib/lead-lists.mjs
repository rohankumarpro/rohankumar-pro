// Link lists that a visitor unlocks with their email (/repos and friends). The links are only sent after sign-up;
// the public page gets the names, notes and logos so it can show what is inside.
export const LISTS = {
  repos: {
    title: "9 free GitHub repos that replace paid software",
    from: "Sansser",
    items: [
      { name: "Open Higgsfield", replaces: "Higgsfield", note: "AI image and video studio", logo: "/img/repos/openhiggsfield.svg", href: "https://github.com/wide-trace/open-higgsfield" },
      { name: "VoiceStudio", replaces: "ElevenLabs", note: "Voice cloning that runs on your own machine", logo: "/img/repos/voicestudio.svg", href: "https://github.com/debpalash/VoiceStudio" },
      { name: "OpenSEO", replaces: "Semrush", note: "Rank tracking, backlinks and site audits", logo: "/img/repos/openseo.webp", href: "https://github.com/every-app/open-seo" },
      { name: "AppFlowy", replaces: "Notion", note: "Docs and wikis that work with local AI models", logo: "/img/repos/appflowy.webp", href: "https://github.com/AppFlowy-IO/AppFlowy" },
      { name: "OpenWhispr", replaces: "Wispr Flow", note: "Dictate into any app, even offline", logo: "/img/repos/openwhispr.webp", href: "https://github.com/OpenWhispr/openwhispr" },
      { name: "OpenProject", replaces: "Asana", note: "Projects, Gantt charts and time tracking", logo: "/img/repos/openproject.webp", href: "https://github.com/opf/openproject" },
      { name: "Cal.com", replaces: "Calendly", note: "Booking pages that sync with Google and Outlook", logo: "/img/repos/calcom.webp", href: "https://github.com/calcom/cal.diy" },
      { name: "Chatwoot", replaces: "Intercom", note: "Every customer message in one inbox", logo: "/img/repos/chatwoot.webp", href: "https://github.com/chatwoot/chatwoot" },
      { name: "Cap", replaces: "Loom", note: "Screen recording you own", logo: "/img/repos/cap.webp", href: "https://github.com/CapSoftware/Cap" },
    ],
    bonus: [
      { name: "WeKnora", replaces: "Notion AI", note: "Ask questions across your own documents, on local models", logo: "", href: "https://github.com/Tencent/WeKnora" },
    ],
  },
};

export const publicList = (id) => {
  const L = LISTS[id];
  if (!L) return null;
  const strip = ({ href, ...rest }) => rest;
  return { id, title: L.title, from: L.from, items: L.items.map(strip), bonus: (L.bonus || []).map(strip) };
};
