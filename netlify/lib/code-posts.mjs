// Journal articles that ship with the code, for when an article is published from the repository instead of the Journal app.
// loadPosts() shows them next to the owner's saved articles, but only while the saved journal has no article with the same slug:
// once the owner edits one in the Journal app (or marks it a draft), the saved copy takes over. Nothing here is ever written to storage.
// To take one down for good, set it to draft in the Journal app (deleting it there would bring this copy back).

export const CODE_POSTS = [
  {
    slug: "featured-in-dribbbles-client-approved-branding-agencies-of-2026",
    title: "Featured in Dribbble's Client-Approved Branding Agencies of 2026",
    tag: "Branding",
    tags: ["Dribbble", "Branding"],
    date: "Oct 8, 2026",
    published: "2026-10-08",
    modified: "2026-10-08T12:00:00.000Z",
    excerpt: "Dribbble has featured me in Client-Approved Branding Agencies in 2026, a list of branding studios and independent designers recommended for the work their clients approved.",
    seoTitle: "Featured by Dribbble: Client-Approved Branding Agencies 2026",
    seoDesc: "Rohan Kumar is featured in Dribbble's Client-Approved Branding Agencies in 2026, alongside 17 branding studios and designers.",
    img: "/img/journal/dribbble-select-2026.webp", // shipped with the code so it shows on previews too
    imgAlt: "Selected by Dribbble: the Dribbble Select Top Branding Agency badge for @rohankumarpro",
    body: `I'm happy to share that Dribbble has featured me in **[Client-Approved Branding Agencies in 2026](https://dribbble.com/stories/2026/08/01/client-approved-branding-agencies-in-2026#rohan-kumar)**.

It's a list of 18 branding studios and independent designers, put together to help founders and companies find a branding partner whose work has already been approved by real clients. And I'm one of them.

## What they said

Dribbble describes me as an independent designer working across branding, graphic design, web design and animation, someone who can take a project from the first brand identity all the way to the digital experience, with a strong focus on cohesive visual systems.

Which is honestly a better description of my job than the one I usually give at family functions.

## Why this one matters to me

There are a lot of design awards out there that are about how good the work looks. And I love good-looking work. But this list is about something else: **whether clients were happy with the work and the way it was done.**

That's the part I care about the most. A brand isn't a nice logo on a Behance page. It's something a business has to live with every day, long after the project is over. So being recognised for the client side of the work, the thinking, the communication and the delivery, means a lot more to me than a pretty shot getting likes.

> Good branding isn't approved by designers. It's approved by the people who have to use it.

I wrote about this in [branding is a journey of earning more goodwill](/journal/branding-is-a-journey-of-earning-more-goodwill). Recognition like this isn't a finish line. It's a small deposit into that account, and the work still has to keep earning it.

## Thank you

To every client who trusted me with their brand: this one is really yours. Thank you for the trust, the honest feedback, and for taking the time to tell others about working together.

Thank you to the Dribbble team for including me, and congratulations to everyone else on the list, including Marka Works, Radiyal, GALAX Studios and Wells Collins. It's good company to be in.

You can see the badge at the top of this site, and the full list on [Dribbble's branding agencies page](https://dribbble.com/branding-agency).

!! Building a brand and looking for a partner? I'm taking on new brand identity and packaging projects.`,
  },
];
