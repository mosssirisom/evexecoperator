// Design tokens for the operator calendar. The colours are registered in
// tailwind.config.ts as `cal-*` (bg-cal-paper, text-cal-ink, …); this file is
// the same set for anything outside Tailwind (charts, canvas, emails) and the
// reference for what each one is for.

export const calendarTokens = {
  color: {
    paper: "#F6F2EA",      // page surface
    sheet: "#FFFDF8",      // raised surface: grid, panels
    well: "#EEE7D9",       // selected day, pressed state
    line: "#E5DDCC",       // hairlines between cells and rows
    rule: "#D2C7B1",       // stronger rules: section edges, inputs
    ink: "#141821",        // primary text, selected-day fill
    ink2: "#3A3F4A",       // secondary text: routes
    muted: "#6D6656",      // labels, metadata
    faint: "#A0977F",      // out-of-month days, done jobs
    brass: "#9C7B34",      // accent: today, focus, awaiting reply
    brassInk: "#76591F",   // accent text on paper (5.6:1)
    brassSoft: "#F2E8CF",
    ok: "#2F6B50",         // confirmed, driver assigned
    okSoft: "#E3EEE6",
    alert: "#A3402C",      // needs driver, clash, unavailable driver
    alertSoft: "#F7E4DC",
    road: "#2E5C88",       // en route / on board
    roadSoft: "#E1EAF3",
  },
  font: {
    display: 'ui-serif, "New York", "Iowan Old Style", "Palatino Linotype", Georgia, serif',
    ui: "Inter, system-ui, sans-serif",
  },
  type: {
    title: "28px/1.05 display, 34px from lg",
    time: "15px/1 ui semibold, tabular figures",
    body: "14px/1.35 ui",
    meta: "12px/1.3 ui",
    label: "10.5px ui semibold, uppercase, 0.08em tracking",
  },
  space: { grid: 4, row: 12, section: 20 },
  radius: { control: 6, panel: 10, mark: 2 },
};

// Status → mark colour and label. Shape carries meaning too (hollow =
// waiting on the office), so it never relies on colour alone.
export const STATE_STYLE = {
  reply:     { mark: "border-[1.5px] border-cal-brass bg-transparent", text: "text-cal-brass-ink", label: "Awaiting reply" },
  driver:    { mark: "bg-cal-alert", text: "text-cal-alert", label: "Needs driver" },
  assigned:  { mark: "bg-cal-ok", text: "text-cal-ok", label: "Driver assigned" },
  road:      { mark: "bg-cal-road", text: "text-cal-road", label: "On the road" },
  done:      { mark: "bg-cal-faint", text: "text-cal-muted", label: "Completed" },
  cancelled: { mark: "border border-cal-faint bg-transparent", text: "text-cal-faint", label: "Cancelled" },
};
