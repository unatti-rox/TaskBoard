/*
  Demo data. Dates are relative to today so the dashboard always looks current.
  Replace this with an API call once a backend exists (see README → Roadmap).
*/
window.createSeedData = function () {
  const U = COUtils;
  const day = U.addDays;
  const today = day(0);
  const weekStart = U.startOfWeek();

  const team = [
    { id: "rahul", name: "Rahul", role: "Video Editor", shortRole: "Editor", capacity: 40 },
    { id: "riya", name: "Riya", role: "Designer", shortRole: "Designer", capacity: 40 },
    { id: "kabir", name: "Kabir", role: "Video Editor", shortRole: "Editor", capacity: 40 },
    { id: "mehul", name: "Mehul", role: "Designer", shortRole: "Designer", capacity: 40 }
  ];

  /* Hours each person is booked this week, including work outside TaskBoard. */
  const weeklyBooking = { rahul: 32, riya: 18, kabir: 40, mehul: 14 };

  const brands = ["Joyville", "Celestia", "Central Park", "Invictus"];

  const projects = [
    { id: "p1", name: "Sensorium Launch", brand: "Joyville", due: day(5), archived: false },
    { id: "p2", name: "Festive Campaign", brand: "Celestia", due: day(3), archived: false },
    { id: "p3", name: "Rebrand Rollout", brand: "Central Park", due: day(9), archived: false },
    { id: "p4", name: "Print & Film", brand: "Invictus", due: day(6), archived: false }
  ];

  function task(id, name, projectId, brand, assignee, estimate, due, priority, status, completedOn, note) {
    return {
      id: id, name: name, projectId: projectId, brand: brand, assignee: assignee, estimate: estimate,
      due: due, priority: priority, status: status, completedOn: completedOn || null, note: note || "",
      createdOn: day(-7)
    };
  }

  const tasks = [
    task("t1", "Sensorium Reel 03", "p1", "Joyville", "rahul", 2, day(0), "high", "completed", today),
    task("t2", "Sensorium Reel 02", "p1", "Joyville", "rahul", 2, day(0), "medium", "completed", today),
    task("t3", "Joyville Teaser Cutdown", "p1", "Joyville", "rahul", 5, day(2), "medium", "progress"),
    task("t4", "Celestia Static 04", "p2", "Celestia", "riya", 3, day(0), "high", "progress"),
    task("t5", "Celestia Static 03", "p2", "Celestia", "riya", 3, day(0), "medium", "completed", today),
    task("t6", "Celestia Carousel", "p2", "Celestia", "riya", 3, day(0), "low", "completed", today),
    task("t7", "Central Park Motion", "p3", "Central Park", "kabir", 8, day(1), "high", "progress"),
    task("t8", "Central Park Logo Sting", "p3", "Central Park", "kabir", 2, day(0), "medium", "completed", today),
    task("t9", "Invictus Art Deco Reel", "p4", "Invictus", "mehul", 6, day(1), "high", "blocked", null, "Waiting for footage"),
    task("t10", "Invictus Print Ad", "p4", "Invictus", "mehul", 4, day(3), "low", "todo"),
    /* Finished earlier, so Analytics and Daily Reports have some history. */
    task("h1", "Sensorium Reel 01", "p1", "Joyville", "rahul", 2, day(-3), "medium", "completed", day(-3)),
    task("h2", "Joyville Brochure", null, "Joyville", "riya", 6, day(-2), "medium", "completed", day(-2)),
    task("h3", "Central Park Site Stills", "p3", "Central Park", "kabir", 5, day(-2), "high", "completed", day(-1)),
    task("h4", "Invictus Moodboard", "p4", "Invictus", "mehul", 3, day(-5), "medium", "completed", day(-4)),
    task("h5", "Celestia Static 02", "p2", "Celestia", "riya", 3, day(-1), "medium", "completed", day(-1)),
    task("h6", "Celestia Static 01", "p2", "Celestia", "riya", 3, day(-3), "medium", "completed", day(-3))
  ];

  const logRows = [
    ["t1", "rahul", 2, 0], ["t2", "rahul", 1.5, 0], ["t3", "rahul", 3, 0],
    ["t4", "riya", 1.5, 0], ["t5", "riya", 2.5, 0], ["t6", "riya", 3, 0],
    ["t7", "kabir", 3, 0], ["t8", "kabir", 2, 0],
    ["t9", "mehul", 1, -1], ["t9", "mehul", 2, -2],
    ["t3", "rahul", 2, -1], ["t7", "kabir", 3, -1],
    ["h1", "rahul", 1.5, -4], ["h1", "rahul", 1, -3],
    ["h2", "riya", 3, -5], ["h2", "riya", 2.5, -4], ["h2", "riya", 1.5, -2],
    ["h3", "kabir", 3, -3], ["h3", "kabir", 2.5, -2], ["h3", "kabir", 1, -1],
    ["h4", "mehul", 2, -6], ["h4", "mehul", 2, -5],
    ["h5", "riya", 2.5, -1], ["h6", "riya", 3, -3]
  ];

  const logs = logRows.map(function (r, i) {
    return { id: "l" + (i + 1), taskId: r[0], memberId: r[1], hours: r[2], date: day(r[3]), note: "" };
  });

  /* Whatever this week's tasks don't account for is booked as "other work". */
  team.forEach(function (m) {
    const taskHours = U.sum(tasks.filter(function (t) {
      return t.assignee === m.id && (t.status !== "completed" || t.completedOn >= weekStart);
    }), function (t) { return t.estimate; });
    m.otherHours = Math.max(0, weeklyBooking[m.id] - taskHours);
  });

  const now = Date.now();
  const activity = [
    { id: "a1", at: new Date(now - 40 * 60000).toISOString(), text: "Riya completed Celestia Carousel" },
    { id: "a2", at: new Date(now - 95 * 60000).toISOString(), text: "Kabir completed Central Park Logo Sting" },
    { id: "a3", at: new Date(now - 180 * 60000).toISOString(), text: "Mehul marked Invictus Art Deco Reel blocked: Waiting for footage" }
  ];

  return {
    version: 2,
    settings: { userName: "Anika Kapoor", teamName: "Creative Operations" },
    team: team,
    brands: brands,
    projects: projects,
    tasks: tasks,
    logs: logs,
    activity: activity,
    notificationsReadAt: null
  };
};
