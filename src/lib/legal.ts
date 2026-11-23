export type LegalSection = {
  id: string;
  heading: string;
  body: string[];
};

export type LegalDoc = {
  slug: string;
  title: string;
  blurb: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    blurb: "What we collect and how we use it",
    updated: "17 November 2026",
    intro:
      "Vydora is an AI video maker for YouTube creators. This policy explains what information we collect when you sign up, make a video or download one, and what we do with it. We do not sell your data.",
    sections: [
      {
        id: "collected",
        heading: "What we collect",
        body: [
          "Account information: your email address, and where you sign in with Google, the name and photo attached to that account.",
          "Your work: video titles, the ideas you type in, scripts, scene text, and the settings you choose (visual style, voice, captions, font, colour, size, format).",
          "Generated files: the pictures, voiceover audio, thumbnails and exported videos created for your projects.",
          "Technical information: browser and device details, and basic logs such as when a generation job starts, finishes or fails, so we can spot and fix problems.",
        ],
      },
      {
        id: "use",
        heading: "How we use it",
        body: [
          "To write scripts, generate scene images, record voiceovers and build thumbnails when you ask for them.",
          "To keep your projects saved so you can come back to them on any device.",
          "To show you your own videos and files, and nobody else's.",
          "To keep the service running: monitoring for failures, abuse and unusual load.",
          "To reply when you contact us for help.",
        ],
      },
      {
        id: "ai",
        heading: "AI services we use",
        body: [
          "To create your video, we send your idea, script and scene prompts to third-party AI providers that write text, generate images and produce speech on our behalf.",
          "We use those providers to deliver the feature you asked for. We do not give them your password or your billing details.",
          "AI output is not stored by Vydora any longer than your project needs it, but each provider has its own processing terms, which we cannot control.",
        ],
      },
      {
        id: "storage",
        heading: "Where your files live",
        body: [
          "Every picture, voiceover and thumbnail is stored in private storage inside a folder keyed to your own account, separate from every other user's.",
          "Files are not public. When you view them in the editor, we hand your browser a short-lived link that only works for you and only for a short time.",
          "Vydora only publishes to YouTube when you connect your channel and choose to publish a video, or give Autopilot permission to upload a planned video. Nothing is posted anywhere else.",
        ],
      },
      {
        id: "youtube",
        heading: "YouTube API Services",
        body: [
          "Vydora uses YouTube API Services to let you publish videos to your own YouTube channel. By connecting YouTube you also agree to the YouTube Terms of Service (https://www.youtube.com/t/terms). Google's Privacy Policy (https://policies.google.com/privacy) explains how Google handles your data.",
          "We ask for two permissions: 'youtube.readonly', used only to read your channel's ID, name and profile picture so we can show you which channel is connected; and 'youtube.upload', used only to upload videos you choose to publish (or that you allow Autopilot to publish), with the title, description, tags, visibility, thumbnail and release time you set.",
          "We store: your channel ID, channel name and channel picture link; an access token and refresh token from Google; and, for each upload, the YouTube video ID, title, visibility, release time and upload status. We do not read, change or delete any other videos, comments, analytics or channel settings.",
          "Your Google tokens are kept only on our servers in a database table that no user, browser or rendering worker can read directly. They are sent only to Google, never shown in your browser, and never written to our logs.",
          "YouTube data is used only to provide the publishing feature. It is not sold, not used for advertising, not shared with AI providers and not used to train any AI model. It is shared only with our hosting provider, which stores it on our behalf.",
          "Disconnecting: go to My profile and press Disconnect. We immediately ask Google to revoke Vydora's access and delete your stored tokens and channel details. You can also remove Vydora at any time from your Google Account's third-party access page (https://myaccount.google.com/connections); the next time Vydora tries to use the connection it detects the revoked access and deletes the stored tokens.",
          "Deletion: you can ask us to delete all stored YouTube information (including upload records) by emailing contact@vydora.ai. We complete deletion within 7 days, and deleting your Vydora account removes it too.",
        ],
      },
      {
        id: "community",
        heading: "Community Showcase",
        body: [
          "If you choose to submit a video to the Community Showcase, we store the YouTube link, title, category, description, the channel name and link you give us, your optional display name, bio and picture link, and a record of when you gave consent.",
          "Only videos our team approves are shown publicly. Your email address and account ID are never shown.",
          "You can remove a video or withdraw consent at any time from your Community profile; withdrawn videos leave the public gallery straight away. Reports about showcased videos are kept so our team can review them.",
        ],
      },
      {
        id: "cookies",
        heading: "Cookies and browser storage",
        body: [
          "We store a sign-in token in your browser so you stay logged in, and remember your editor choices between visits.",
          "If you accept advertising on our cookie banner, Google Ads sets cookies so we can see which of our ads led to a sign-up or purchase. Nothing is sent to Google before you accept, and you can change your choice any time from Cookie settings in the footer. See our Cookie Policy.",
        ],
      },
      {
        id: "sharing",
        heading: "Who else sees it",
        body: [
          "We do not sell your personal information. If you accept advertising cookies, Google receives the page visited, that a sign-up or purchase happened, its value and a payment reference, to measure and improve our ads. Your email address is not sent.",
          "We share it only with the service providers who host our infrastructure and run AI generation for us, and only to the extent they need to.",
          "We may disclose information if we are legally required to, or to protect people from harm or our service from abuse.",
          "If Vydora is bought by or merged into another business, your information may transfer with it; we would tell you if that happened.",
        ],
      },
      {
        id: "retention",
        heading: "How long we keep it",
        body: [
          "Your projects, scenes and generated files are kept until you delete them, or until you ask us to close your account.",
          "Deleting a video removes its scenes and generated files from storage.",
          "We keep minimal records for accounting and abuse-prevention where the law or a legitimate business reason requires it.",
        ],
      },
      {
        id: "rights",
        heading: "Your choices",
        body: [
          "You can edit or delete any video from your dashboard at any time.",
          "You can download your exported video, thumbnail and script whenever you like, so your work is never locked in.",
          "You can ask us to delete your account and everything attached to it by emailing contact@vydora.ai from the address you signed up with.",
          "If you are in the UK, EU or another region with data-protection laws, you can request a copy of your data, ask for corrections, or object to certain processing, the same way.",
        ],
      },
      {
        id: "security",
        heading: "Keeping it safe",
        body: [
          "Your files sit in private storage with per-account folders, and are only reachable through short-lived links issued to you.",
          "Access to your projects is checked on every request, so a signed-out visitor cannot load your videos.",
          "No system is perfectly secure. If you ever believe your account is compromised, change your password and email contact@vydora.ai.",
        ],
      },
      {
        id: "children",
        heading: "Children",
        body: [
          "Vydora is for adults. We do not knowingly collect information from anyone under 16, and we ask that anyone under 18 uses it only with a parent or guardian's involvement.",
        ],
      },
      {
        id: "changes",
        heading: "Changes to this policy",
        body: [
          "If we make a material change, we will update the date at the top of this page and, where the change matters to you, tell you in the app or by email.",
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Service",
    blurb: "The rules for using Vydora",
    updated: "5 November 2026",
    intro:
      "These terms are the agreement between you and Vydora. By signing up or using the service, you accept them. Please read them — especially the parts about your content and what you publish.",
    sections: [
      {
        id: "service",
        heading: "What Vydora does",
        body: [
          "Vydora turns an idea you type into a YouTube-ready video: it writes a script, creates an image for each scene, records a voiceover, and lets you preview, caption and download the result.",
          "Features, limits and prices can change. We may add, rename or retire parts of the service, and we will try to give notice when a change affects you.",
        ],
      },
      {
        id: "eligibility",
        heading: "Who can use it",
        body: [
          "You must be at least 16 years old (or the age of majority where you live, if higher).",
          "You must give accurate information when creating an account and keep it up to date.",
          "You are responsible for everything that happens under your account, so keep your password and any shared device safe.",
        ],
      },
      {
        id: "your-content",
        heading: "Your content stays yours",
        body: [
          "You keep ownership of the ideas, text and material you supply, and of the videos you make with Vydora, subject to the licences the underlying AI providers grant.",
          "You give us a limited licence to host, store, process and display your content solely so we can build and deliver your videos, and to show them to you.",
          "That licence ends when you delete the content, except where we must keep copies for legal reasons or backup.",
        ],
      },
      {
        id: "responsibility",
        heading: "You are responsible for what you publish",
        body: [
          "You decide what to publish and where. Before uploading, check that you have the rights to every idea, fact, name, image and clip involved.",
          "You must follow the rules of the platform you publish to, including YouTube's policies on spam, misleading content and synthetic media.",
          "Where a platform requires you to label AI-generated or altered content, you are responsible for doing so.",
        ],
      },
      {
        id: "community",
        heading: "Community Showcase",
        body: [
          "Submitting a video to the Community Showcase is optional and free. You must own the video and channel or have permission to share them.",
          "By submitting, you allow Vydora to show the video through YouTube's player, with its thumbnail, title and your creator details, in the public showcase. You can ask for removal at any time by removing it from your Community profile.",
          "We review every submission and may decline, edit the category or description of, or remove any video at our discretion.",
        ],
      },
      {
        id: "acceptable-use",
        heading: "Acceptable use",
        body: [
          "Do not use Vydora to create or spread content that infringes someone else's rights, impersonates a real person, harasses or harms anyone, promotes violence or self-harm, sexualises children, or spreads dangerous misinformation.",
          "Do not use the service to generate spam, manipulate platforms, or mislead viewers about who made a video or why.",
          "Do not probe, scrape, overload or bypass the service's limits, billing or safety measures, or resell access without our written permission.",
          "Full detail is in our Acceptable Use Policy.",
        ],
      },
      {
        id: "usage",
        heading: "Usage limits and fair use",
        body: [
          "Each video you generate uses AI work — one image and one voiceover per scene — so longer videos cost more than short ones. We may apply limits per account, per plan or per period to keep the service usable for everyone.",
          "We may throttle or pause generation that looks abusive, automated at scale, or designed to evade limits.",
        ],
      },
      {
        id: "plans",
        heading: "Free use and paid plans",
        body: [
          "Where we offer paid plans, fees are billed in advance, renew automatically until cancelled, and are subject to the plan terms shown when you buy.",
          "Refunds follow our Refund Policy.",
          "You can usually cancel a subscription at any time; it stays active until the end of the period you already paid for.",
        ],
      },
      {
        id: "availability",
        heading: "Availability and your work",
        body: [
          "We aim to keep Vydora running, but it is provided without a guarantee of uninterrupted availability. AI providers occasionally fail or slow down.",
          "Download the videos and thumbnails you care about. We are not liable for work lost because it was never exported, and we recommend keeping your own copies of anything you publish.",
        ],
      },
      {
        id: "termination",
        heading: "Ending your use",
        body: [
          "You can stop using Vydora and delete your videos at any time.",
          "We may suspend or close accounts that break these terms, abuse the service, or create legal risk or harm. Where we can, we will tell you why and give you a chance to put things right.",
          "On closure, you may be able to request an export of your content for a limited time.",
        ],
      },
      {
        id: "disclaimer",
        heading: "Disclaimers",
        body: [
          "The service is provided 'as is'. AI output can be inaccurate, offensive, or unsuitable, and may resemble other people's work.",
          "You are responsible for checking facts, claims, and rights before publishing. Vydora is not professional, legal, medical or financial advice.",
          "See our Disclaimer for the full statement.",
        ],
      },
      {
        id: "liability",
        heading: "Liability",
        body: [
          "To the extent the law allows, Vydora is not liable for indirect or consequential losses, lost profits, lost views or revenue, lost data, or the content of AI-generated output.",
          "Our total liability for any claim is limited to the amount you paid us in the twelve months before the claim, or a small fixed amount if you have not paid us.",
          "Nothing here limits liability for death, personal injury caused by negligence, fraud, or anything else that cannot be limited by law.",
        ],
      },
      {
        id: "law",
        heading: "Governing law",
        body: [
          "These terms are governed by the laws of England and Wales, and the courts of England and Wales have jurisdiction over disputes, unless mandatory local law says otherwise where you live.",
        ],
      },
      {
        id: "changes",
        heading: "Changes to these terms",
        body: [
          "We may update these terms. If changes materially affect you, we will give reasonable notice in the app or by email before they take effect.",
          "Continuing to use Vydora after changes take effect means you accept them.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    blurb: "Small files that keep you signed in",
    updated: "5 November 2026",
    intro:
      "Cookies and similar browser storage are small pieces of data saved on your device. This page explains which ones Vydora uses. Advertising cookies are used only if you accept them.",
    sections: [
      {
        id: "what",
        heading: "What cookies are",
        body: [
          "A cookie is a tiny file a website saves on your device. Browser storage works the same way: the site saves a small amount of data that it can read back when you return.",
          "They are what let a site remember that you are signed in, and remember the choices you made last time.",
        ],
      },
      {
        id: "essential",
        heading: "Essential sign-in storage",
        body: [
          "A sign-in token so you stay logged in between visits and do not have to sign in on every page.",
          "Session and security data used to check that the person requesting your videos is actually you.",
          "Without these, sign-in and your private projects cannot work at all.",
        ],
      },
      {
        id: "preferences",
        heading: "Preferences",
        body: [
          "Your editor choices — visual style, voice, caption type, font, colour, size and video format — so a video looks the way you left it.",
          "These make the app feel consistent; they are not used to profile you.",
        ],
      },
      {
        id: "analytics",
        heading: "Analytics",
        body: [
          "We keep technical logs on our own servers about which features succeed or fail, so we can fix broken things.",
          "We count page visits without cookies. If you accept analytics, we also measure clicks.",
        ],
      },
      {
        id: "third-party",
        heading: "Third-party cookies",
        body: [
          "Advertising (Google Ads): only if you accept, Google sets cookies to measure which of our ads lead to sign-ups and purchases. Visitors in the UK, EU, Switzerland and Canada are asked first; everyone can reject or change this in Cookie settings. See https://business.safety.google/privacy/.",
          "If you sign in with Google, Google sets its own cookies during that sign-in, under Google's own privacy policy.",
        ],
      },
      {
        id: "manage",
        heading: "Managing cookies",
        body: [
          "Use Cookie settings in the footer to change your choices at any time. Your browser settings also let you block or clear cookies and site storage. Clearing them will sign you out of Vydora.",
          "Blocking essential storage means you will not be able to sign in or reach your saved videos.",
        ],
      },
      {
        id: "contact",
        heading: "Questions",
        body: [
          "If you want to know exactly what we hold about you, email contact@vydora.ai from the address you signed up with.",
        ],
      },
    ],
  },
  {
    slug: "refund",
    title: "Refund Policy",
    blurb: "When you can get your money back",
    updated: "5 November 2026",
    intro:
      "AI work is consumed the moment it is generated, so refunds depend on whether the work has already been used. This is what you can expect.",
    sections: [
      {
        id: "free",
        heading: "Free use",
        body: [
          "Vydora can be tried without paying. If you are not sure a paid plan suits you, make a video first and see whether the output works for you.",
        ],
      },
      {
        id: "subscriptions",
        heading: "Subscriptions",
        body: [
          "If you buy a subscription and it is your first purchase of that plan, you can ask for a refund within 14 days and we will refund it in full, no questions asked.",
          "After 14 days, you can cancel at any time and keep access until the end of the period you already paid for; we do not refund unused days in the current period.",
          "You can cancel a renewal before it is charged and you will not be billed for the next period.",
        ],
      },
      {
        id: "usage",
        heading: "Usage and generation credits",
        body: [
          "One-off charges for AI work already performed — scripts written, images generated, voiceovers recorded, thumbnails made — are generally not refundable, because the work has already been done.",
          "If a generation failed or produced nothing usable, you have not been charged for it in substance: tell us and we will credit you or refund that charge.",
        ],
      },
      {
        id: "problems",
        heading: "Technical problems",
        body: [
          "If a bug stops you using a feature you paid for, email contact@vydora.ai. We will try to fix it or give you a credit.",
          "If the problem is serious and we cannot resolve it, we will refund the affected charge.",
        ],
      },
      {
        id: "how",
        heading: "How to request a refund",
        body: [
          "Email us from the address you signed up with, and include the date of the charge and what went wrong.",
          "Approved refunds go back to the original payment method and usually appear within 5 to 10 working days, depending on your bank.",
        ],
      },
      {
        id: "abuse",
        heading: "Repeated requests",
        body: [
          "Refunds are there for genuine problems. If someone repeatedly buys, uses everything, and asks for money back, we may decline further refunds and close the account.",
        ],
      },
      {
        id: "law",
        heading: "Your legal rights",
        body: [
          "Nothing in this policy takes away your statutory rights, including any cooling-off rights that apply where you live.",
        ],
      },
    ],
  },
  {
    slug: "disclaimer",
    title: "Disclaimer",
    blurb: "What Vydora does not promise",
    updated: "5 November 2026",
    intro:
      "Vydora makes videos quickly, and that speed comes with limits. This page spells out what you should not rely on.",
    sections: [
      {
        id: "accuracy",
        heading: "AI output can be wrong",
        body: [
          "Scripts, facts, dates, names, quotes and statistics written by AI may be inaccurate, out of date or invented. Always check anything you state as fact.",
          "Generated images may show real brands, real places or real-looking people that do not match reality, and may resemble other people's artwork.",
          "You are responsible for reviewing every scene before you publish it.",
        ],
      },
      {
        id: "no-advice",
        heading: "Not professional advice",
        body: [
          "Nothing Vydora generates is legal, medical, financial, tax or professional advice.",
          "If your video touches a regulated topic — health, money, law, safety — have a qualified person check it.",
        ],
      },
      {
        id: "results",
        heading: "No promise of results",
        body: [
          "We do not promise views, subscribers, monetisation, or any income. What a video earns depends on the topic, the platform, the audience and your own effort.",
          "Any example numbers you see elsewhere are illustrative, not a forecast.",
        ],
      },
      {
        id: "availability",
        heading: "Service availability",
        body: [
          "Generation depends on third-party AI providers and can fail, slow down or change quality without notice.",
          "Keep your own copy of any video you care about. Download it.",
        ],
      },
      {
        id: "third-party",
        heading: "Third-party platforms",
        body: [
          "Publishing to YouTube, TikTok, Instagram and similar platforms is governed by their rules, not ours. They may remove, label, demonetise or restrict your video.",
          "We are not responsible for how a platform treats your content.",
        ],
      },
      {
        id: "synthetic",
        heading: "Synthetic media",
        body: [
          "Vydora creates synthetic images and synthetic speech. Using it to deceive people, impersonate someone, or pass off false claims as real is against our terms.",
          "Where a platform or law requires you to disclose that content is AI-generated, that disclosure is your responsibility.",
        ],
      },
      {
        id: "changes",
        heading: "Updates",
        body: [
          "This disclaimer may be updated as the service and the law change. The date at the top shows when it last changed.",
        ],
      },
    ],
  },
  {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    blurb: "What you must not make with Vydora",
    updated: "5 November 2026",
    intro:
      "Vydora generates convincing video and voice quickly, which makes misuse easy to spot and costly to allow. These are the lines you must not cross.",
    sections: [
      {
        id: "rights",
        heading: "Respect other people's rights",
        body: [
          "Do not generate videos that copy or infringe someone else's copyright, trademarks, or personality rights.",
          "Do not upload or ask us to reproduce material you have no right to use.",
        ],
      },
      {
        id: "impersonation",
        heading: "No impersonation or deception",
        body: [
          "Do not clone or imitate a real person's voice, face, or identity without their clear permission.",
          "Do not create deepfakes or synthetic media intended to mislead people about who said what, or whether an event happened.",
          "Do not use Vydora for fraud, scams, fake reviews, or fake news.",
        ],
      },
      {
        id: "harm",
        heading: "No harmful content",
        body: [
          "No child sexual abuse material, or anything that sexualises minors. This is reported to the authorities without exception.",
          "No content that promotes violence, terrorism, or self-harm, and no instructions for building weapons.",
          "No hate speech, or content that attacks or dehumanises people because of who they are.",
          "No harassment, bullying, doxxing, or targeted abuse of individuals.",
        ],
      },
      {
        id: "misinformation",
        heading: "No dangerous misinformation",
        body: [
          "Do not use the service to manufacture convincing false claims about elections, public health, disasters, or public figures.",
          "If you make a fictional or satirical video, present it as such.",
        ],
      },
      {
        id: "spam",
        heading: "No spam or platform manipulation",
        body: [
          "Do not mass-produce low-effort videos to flood a platform, game a recommendation system, or farm ad revenue.",
          "Do not use Vydora to build networks of fake accounts or fake engagement.",
        ],
      },
      {
        id: "service",
        heading: "Do not abuse the service itself",
        body: [
          "Do not scrape, resell, reverse-engineer, or automate bulk access to our AI features without permission.",
          "Do not bypass payment, credit limits, safety filters, or account restrictions, and do not share accounts to get around them.",
          "Do not try to probe, disrupt, or overload our systems or storage.",
        ],
      },
      {
        id: "disclosure",
        heading: "Labelling synthetic media",
        body: [
          "Many platforms and some laws require AI-generated or altered content to be disclosed. Where it applies, you must label your video.",
          "We may add disclosure tools, but the obligation to use them is yours.",
        ],
      },
      {
        id: "enforcement",
        heading: "What happens if you break these rules",
        body: [
          "We can remove content, throttle or suspend generation, and suspend or close accounts — immediately where the harm is serious.",
          "We may report illegal content to the relevant authorities.",
          "If you think someone is misusing Vydora, tell us from the email address you signed up with and we will investigate.",
        ],
      },
    ],
  },
];

export function findLegalDoc(slug?: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((doc) => doc.slug === slug);
}
