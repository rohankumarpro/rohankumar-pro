// Link lists that a visitor unlocks with their email (/repos and friends). The links and install guides are only sent
// after sign-up; the public page gets the names, notes and logos so it can show what is inside.
// Guides follow each project's own README (checked October 2026). A step is text, or {code} for a command to copy.
// level: "Easy" (download an app or use the hosted version), "Medium" (one Docker command or two), "Advanced" (a server).
export const LISTS = {
  repos: {
    title: "9 free GitHub repos that replace paid software",
    from: "Sansser",
    items: [
      {
        name: "Open Higgsfield", replaces: "Higgsfield", note: "AI image and video studio", logo: "/img/repos/openhiggsfield.svg", href: "https://github.com/wide-trace/open-higgsfield",
        guide: {
          level: "Easy", easiest: "No install: use the free hosted studio at openhiggsfield.ai and add your own generation key.",
          needs: "A generation platform key (you pay per image or video you make). To run it yourself: Node.js and pnpm.",
          steps: [
            "Open openhiggsfield.ai, press Add key and paste your key as id:secret. That's it.",
            "To run your own copy instead, open a terminal and run:",
            { code: "git clone https://github.com/wide-trace/open-higgsfield.git\ncd open-higgsfield\npnpm install\npnpm dev" },
            "Open http://localhost:3000, press Add key, paste your key and type your first prompt.",
          ],
          docs: "https://www.openhiggsfield.ai",
        },
      },
      {
        name: "VoiceStudio", replaces: "ElevenLabs", note: "Voice cloning that runs on your own machine", logo: "/img/repos/voicestudio.svg", href: "https://github.com/debpalash/VoiceStudio",
        guide: {
          level: "Easy", easiest: "Download the desktop app from the Releases page (macOS .dmg, Windows .exe, Linux .AppImage or .deb).",
          needs: "Fastest on an NVIDIA GPU or Apple Silicon Mac. It also runs on a normal PC's CPU, slower, with about 5 GB free disk. On Intel Macs only the app screen works.",
          steps: [
            "Download it from github.com/debpalash/VoiceStudio/releases, or install it with one command. macOS or Linux:",
            { code: "curl -fsSL https://voicestudio.sh/install | sh" },
            "Windows (in PowerShell):",
            { code: "irm https://voicestudio.sh/install | iex" },
            "Open the app and go to Voice cloning. Pick a voice or add a clean recording of your own voice.",
            "Type your text and press Generate. Install the voice model when the app asks; after that everything runs on your machine.",
          ],
          docs: "https://github.com/debpalash/VoiceStudio#get-started",
        },
      },
      {
        name: "OpenSEO", replaces: "Semrush", note: "Rank tracking, backlinks and site audits", logo: "/img/repos/openseo.webp", href: "https://github.com/every-app/open-seo",
        guide: {
          level: "Medium", easiest: "Try it free on openseo.so first. Run your own copy when you want full control.",
          needs: "Docker Desktop and a DataForSEO API key (you pay DataForSEO only for the data you use, no subscription).",
          steps: [
            "Get a DataForSEO API key at dataforseo.com.",
            "Open a terminal and run:",
            { code: "git clone https://github.com/every-app/open-seo.git\ncd open-seo\ncp .env.example .env" },
            "Open the new .env file and paste your key after DATAFORSEO_API_KEY=",
            { code: "docker compose up -d" },
            "Open http://localhost:3001. The first start takes a minute or two.",
            "This copy has no login, so keep it on your own computer or behind a private network.",
          ],
          docs: "https://github.com/every-app/open-seo/blob/main/docs/SELF_HOSTING_DOCKER.md",
        },
      },
      {
        name: "AppFlowy", replaces: "Notion", note: "Docs and wikis that work with local AI models", logo: "/img/repos/appflowy.webp", href: "https://github.com/AppFlowy-IO/AppFlowy",
        guide: {
          level: "Easy", easiest: "Download the desktop app for macOS, Windows or Linux and start writing. No server needed.",
          needs: "Nothing extra. A team server is optional, for when you want to share workspaces.",
          steps: [
            "Download AppFlowy from github.com/AppFlowy-IO/AppFlowy/releases. On Linux you can also get it from Flathub or Snapcraft.",
            "Open it and create your first page. Your pages stay on your computer.",
            "Want the AI features on local models? Follow AppFlowy's AI setup guide in their docs.",
            "To share with a team, AppFlowy has a step-by-step self-hosting guide.",
          ],
          docs: "https://appflowy.com/docs/Step-by-step-Self-Hosting-Guide---From-Zero-to-Production",
        },
      },
      {
        name: "OpenWhispr", replaces: "Wispr Flow", note: "Dictate into any app, even offline", logo: "/img/repos/openwhispr.webp", href: "https://github.com/OpenWhispr/openwhispr",
        guide: {
          level: "Easy", easiest: "Download the app (macOS, Windows or Linux), pick a local model, press the hotkey and talk.",
          needs: "Nothing extra. Local models keep your voice on your device.",
          steps: [
            "Download it from github.com/OpenWhispr/openwhispr/releases. On a Mac you can also use Homebrew:",
            { code: "brew install --cask openwhispr" },
            "Open it and choose a local speech model (Whisper or Parakeet) so it works offline.",
            "Click into any app, press the hotkey, speak, and your words appear where the cursor is.",
          ],
          docs: "https://docs.openwhispr.com/quickstart",
        },
      },
      {
        name: "OpenProject", replaces: "Asana", note: "Projects, Gantt charts and time tracking", logo: "/img/repos/openproject.webp", href: "https://github.com/opf/openproject",
        guide: {
          level: "Medium", easiest: "Run the free Community edition with one Docker command.",
          needs: "Docker Desktop.",
          steps: [
            "Make a secret key and save it somewhere safe. You need the same one every time you start OpenProject:",
            { code: "openssl rand -hex 64" },
            "Start OpenProject, putting your key in place of YOUR_KEY:",
            { code: "docker run -it -p 8080:80 \\\n  -e SECRET_KEY_BASE=YOUR_KEY \\\n  -e OPENPROJECT_HOST__NAME=localhost:8080 \\\n  -e OPENPROJECT_HTTPS=false \\\n  -e OPENPROJECT_DEFAULT__LANGUAGE=en \\\n  openproject/openproject:17" },
            "Wait a few minutes for the success message, then open http://localhost:8080.",
            "Sign in with admin / admin and change the password straight away.",
          ],
          docs: "https://www.openproject.org/docs/installation-and-operations/installation/docker/",
        },
      },
      {
        name: "Cal.com", replaces: "Calendly", note: "Booking pages that sync with Google and Outlook", logo: "/img/repos/calcom.webp", href: "https://github.com/calcom/cal.diy",
        guide: {
          level: "Medium", easiest: "The self-hosted version is now called Cal.diy. It runs with Docker in a few commands.",
          needs: "Docker Desktop and Git.",
          steps: [
            "Download it and make your settings file:",
            { code: "git clone --recursive https://github.com/calcom/cal.diy.git\ncd cal.diy\ncp .env.example .env" },
            "Make two secret keys and paste them into .env after NEXTAUTH_SECRET= and CALENDSO_ENCRYPTION_KEY=",
            { code: "openssl rand -base64 32\nopenssl rand -base64 24" },
            "Start it:",
            { code: "docker compose up -d" },
            "Open http://localhost:3000 and follow the setup wizard to make your account.",
            "Connect Google Calendar or Outlook later from Settings, then Integrations.",
          ],
          docs: "https://github.com/calcom/cal.diy#docker",
        },
      },
      {
        name: "Chatwoot", replaces: "Intercom", note: "Every customer message in one inbox", logo: "/img/repos/chatwoot.webp", href: "https://github.com/chatwoot/chatwoot",
        guide: {
          level: "Advanced", easiest: "No server yet? Chatwoot has one-click deploys on Heroku and DigitalOcean (you pay for the hosting).",
          needs: "A Linux server with Docker, and a domain if customers will reach it from the web.",
          steps: [
            "On your server, download the settings and the Docker file:",
            { code: "wget -O .env https://raw.githubusercontent.com/chatwoot/chatwoot/develop/.env.example\nwget -O docker-compose.yaml https://raw.githubusercontent.com/chatwoot/chatwoot/develop/docker-compose.production.yaml" },
            "Open .env (nano .env) and fill in SECRET_KEY_BASE, POSTGRES_PASSWORD and REDIS_PASSWORD with your own long random values.",
            "Prepare the database, then start Chatwoot:",
            { code: "docker compose run --rm rails bundle exec rails db:chatwoot_prepare\ndocker compose up -d" },
            "It runs on port 3000. Put it behind Nginx with your domain, then add your website chat, email, Instagram and WhatsApp inboxes.",
          ],
          docs: "https://www.chatwoot.com/docs/self-hosted/deployment/docker",
        },
      },
      {
        name: "Cap", replaces: "Loom", note: "Screen recording you own", logo: "/img/repos/cap.webp", href: "https://github.com/CapSoftware/Cap",
        guide: {
          level: "Easy", easiest: "Download Cap for macOS or Windows, record, and share the link.",
          needs: "Nothing extra. Self-hosting the sharing website is optional and needs Docker.",
          steps: [
            "Download it from cap.so/download and sign in.",
            "Choose Instant Mode (link ready the moment you stop) or Studio Mode (edit before sharing), then record.",
            "Share the link, export the file, or keep it on your computer.",
            "Optional, to host the sharing site yourself:",
            { code: "git clone https://github.com/CapSoftware/Cap.git\ncd Cap\ndocker compose up -d" },
            "Open http://localhost:3000 (the login link is in docker compose logs), then point the app at it in Settings, Cap Server URL.",
          ],
          docs: "https://cap.so/docs",
        },
      },
    ],
    bonus: [
      {
        name: "WeKnora", replaces: "Notion AI", note: "Ask questions across your own documents, on local models", logo: "", href: "https://github.com/Tencent/WeKnora",
        guide: {
          level: "Medium", easiest: "Runs with Docker. Add Ollama if you want everything on local models.",
          needs: "Docker Desktop and Git. Ollama for local models.",
          steps: [
            "Open a terminal and run:",
            { code: "git clone https://github.com/Tencent/WeKnora.git\ncd WeKnora\ncp .env.example .env\ndocker compose pull\ndocker compose up -d" },
            "Open http://localhost and follow the onboarding.",
            "For local models, start Ollama first (ollama serve) and pick your Ollama models during setup.",
          ],
          docs: "https://github.com/Tencent/WeKnora#quick-start",
        },
      },
    ],
  },
};

export const publicList = (id) => {
  const L = LISTS[id];
  if (!L) return null;
  const strip = ({ href, guide, ...rest }) => ({ ...rest, level: guide?.level });
  return { id, title: L.title, from: L.from, items: L.items.map(strip), bonus: (L.bonus || []).map(strip) };
};
