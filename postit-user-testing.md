## 2026-11-09 — Postit v1 user testing (5 testers)

- **What we tested:** Postit v1, a clickable desktop prototype of a shared media board. Each tester signed in as one of five color-coded teammates (Director, Photographer, Videographer, Model, Brand rep), uploaded photos, voted thumbs up/down on photos in a post draft, edited the shared caption, and used the live Instagram preview. Four simulated teammates moved, voted and typed live in the background.
- **With whom:** Opal (Photographer, then Director), Hayden (Photographer), Viola (Director), Sonny (Photographer), Bella (Director).
- **What happened, person by person:**
  - **Opal (Photographer role):** wanted it clearer which photos are approved and which aren't. Asked for notes on photos. Wanted a bigger upload button, ideally just a "+" icon with more visual weight. Said she'd need to use it a few times to learn it. Wanted more color difference between the panels (uploading media, building the post, the final preview), and more color-coding overall. Thumbs up/down made sense right away. On the photos, "Shot by [name]" is enough, so the initials badge isn't needed. Wanted to collapse and simplify parts of the screen depending on the task.
  - **Opal (Director role):** finalizing made sense, but the button should be at the top. Asked for:
    - a director override on approvals
    - messaging people from the left side
    - a whole-group message
    - color and a cover photo on each draft in the left sidebar
    - an expandable/collapsible image panel
    - a "Post to Instagram" button under the preview once a post is finalized
    - a setting for who has a say in approvals
    - a grid view to see how a cover looks on the profile

    Quote: "Shit, I would use this for my own Instagram."
  - **Hayden (Photographer role):** could see it being useful for branding and team work. Loved the Instagram preview on the side. Could tell the drafts apart easily and liked seeing all uploaded media in one place and who's working on what. Wanted a chat. Liked being in the same workspace, comparing it to Teams ("missing a lot for collaboration, good for messaging though"). Was "super impressed with the functionality." Was curious about preferences and how the team roles map to real jobs.
  - **Viola (Director role):** noticed the moving cursors right away and the notice that Jordan was doing something. Found the post, approved photos, and said "Okay, that's fun." Got briefly lost after clicking into a different draft while also turning live teammates off. Finalized easily, but said the finalize button should be at the top or sticky because she might not have found it as fast otherwise. Wanted to collapse panels and see the finished post bigger.
  - **Sonny (Photographer role):** found that the Single image post type didn't work. Suggested moving the History tab to an icon on the left side. Felt like "a lot of information thrown at you." Wanted to click into projects instead of seeing everything at once, open a big pop-up preview of any image, and click into images in post drafts. Asked whether the preview always needs to be open, e.g. collapsing it in the media view.
  - **Bella (Director role):** browsed all the drafts and found it "very organized." Had a hard time finding the finalize button, and wanted the preview bigger once a post was finalized. Suggested moving the live-teammates toggle next to people's names.
- **What surprised us:** the core loop (upload, vote, preview) needed no explanation for any of the five testers, and both directors said they'd use it for real. The problems were about layout and hierarchy, not the concept. Three of five (Opal, Viola, Bella) independently struggled to find Finalize at the bottom of the page. Three asked for collapsible panels, and two asked for chat. On laptop screens the right side of v1 was cut off, which made the crowding worse.

### Patterns across testers

| Theme | Who raised it |
|---|---|
| Finalize button is hard to find, move it to the top | Opal, Viola, Bella |
| Collapse panels and reduce how much is on screen | Opal, Viola, Sonny |
| Bigger view of photos and of the finished post | Viola, Sonny, Bella |
| Chat, both group and direct messages | Opal, Hayden |
| Clearer approved / not approved status | Opal |
| Director override and approval settings | Opal, Hayden |
| Single image post type is broken | Sonny |

### Changes made in v2

- **Finalize at the top:** a sticky header holds the Finalize button, with a short reason when it's disabled (e.g. "2 photos need votes first"). Finalizing opens a large preview of the finished post.
- **Post to Instagram:** a button under the preview appears once the post is finalized. It runs a simulated posting step and shows the post in the profile grid.
- **Grid view:** the preview has Post / Grid tabs. Grid shows the profile with this post as the newest tile, plus a "Try a different cover" picker.
- **Director override:** the director gets a "Director call: Approve / Decline" control on every photo that overrides the votes.
- **Settings panel:** sets approvals needed, which roles can vote, director override on/off, and who can finalize. It also lists each role and what that person can do on the project (answers Hayden's question about roles and jobs).
- **Team chat:** a Chat panel on the left with an "Everyone" group thread and direct messages to each teammate, plus unread badges and typing indicators. Clicking any teammate's avatar opens a DM.
- **Collapsible layout:** a left icon rail (Projects, Drafts, Chat, Activity, Settings) opens one panel at a time. The Media tray and the Preview both collapse to thin strips, and the Media view hides the preview entirely.
- **Projects home:** you start on project cards with cover photos and click into a project.
- **Big photo viewer:** clicking any photo in Media, the tray or a draft opens a full-size viewer with arrow-key navigation, credits, voting, tags and notes.
- **Notes on photos:** teammates can leave notes on any photo.
- **Clearer status:** each photo in a post has a full-width colored band (green Approved, amber Needs votes, red Declined), and filter chips show counts for each status.
- **Color and simplification:** the Media, Build and Preview zones are tinted differently (cool, neutral, warm). The initials badge on photos was replaced with "Shot by [name]." The media library can group photos by person under that person's color.
- **Drafts sidebar:** each draft shows a cover thumbnail and a colored status stripe.
- **Upload:** a large round "+" button sits in the top bar.
- **Live teammates toggle:** moved next to the team list.
- **Single image fixed:** Single image posts now use one photo. Extra photos are marked "Not used," and adding more prompts a switch to Carousel.

### Next round to test

- Do directors find Finalize and Post to Instagram without help now?
- Does the collapsible layout feel simpler, or does the icon rail add a new thing to learn?
- Is chat used during the task, or only noticed?
- Is the director override seen as helpful or as overriding the team?
