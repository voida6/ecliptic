# Changelog

## 0.1.1

- Ticking a task on Today keeps your place instead of jumping back to the top (phone and desktop).

## 0.1.0

First release.

- Home: your top-level folders orbit a planet as moons. Each moon's line says the most useful thing about the folder: overdue tasks, the tightest deadline, the next shift or class, or when it was last edited.
- Today: today's note, open tasks from the whole vault, recent notes, the week with due dates and shifts, the moon's phase and sunrise and sunset.
- Folder pages picked from what is inside: work and career, journal, courses, projects, reading queue and plain folders. "Change" on a page picks another type.
- Before it's due: for each deadline in the next two weeks, the free hours before it against the hours it needs, after shifts, classes and travel. Hours needed come from an `effort` field, from the weight, or are shown as unknown.
- Free hours are capped at 6 h a day by default, so a free weekend does not count as twelve hours of work. Change it with "Most hours you'd work in a day" in settings; 0 turns the cap off.
- Tasks tick off in place, on the phone as well as on the wide page, and today's note can be created from Today.
- Worlds to travel between (Saturn, Earth and more), with an optional whole-app colour theme, asked once on first open.
- Place for sunrise and sunset, with optional live weather. Both are off until you set them.
- When there are more folders than fit around the planet, Home says "+N more folders"; tapping it opens the folder list in settings.
- Due dates that cannot exist (such as 29 February in a year that has none) are ignored, and a due date in another year shows its year.
- Works on desktop and on phones, in Obsidian's dark and light themes.
- A demo vault is published with the release. Its date is pinned with the `debugDate` key in `data.json`.
