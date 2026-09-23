/*
  Demo data. Dates are relative to today so the dashboard always looks current.
  Replace this with an API call once a backend exists (see README → Roadmap).
*/
window.createSeedData = function () {
  const day = COUtils.addDays;
  const today = day(0);

  const team = [
    { id: "rahul", name: "Rahul", role: "Video Editor", shortRole: "Editor", capacity: 40, allocated: 32 },
    { id: "riya", name: "Riya", role: "Designer", shortRole: "Designer", capacity: 40, allocated: 18 },
    { id: "kabir", name: "Kabir", role: "Video Editor", shortRole: "Editor", capacity: 40, allocated: 40 },
    { id: "mehul", name: "Mehul", role: "Designer", shortRole: "Designer", capacity: 40, allocated: 14 }
  ];

  const brands = ["Joyville", "Celestia", "Central Park", "Invictus"];

  const tasks = [
    { id: "t1", name: "Sensorium Reel 03", brand: "Joyville", assignee: "rahul", estimate: 2, due: day(0), priority: "high", status: "completed", completedOn: today },
    { id: "t2", name: "Sensorium Reel 02", brand: "Joyville", assignee: "rahul", estimate: 2, due: day(0), priority: "medium", status: "completed", completedOn: today },
    { id: "t3", name: "Joyville Teaser Cutdown", brand: "Joyville", assignee: "rahul", estimate: 5, due: day(2), priority: "medium", status: "progress", completedOn: null },
    { id: "t4", name: "Celestia Static 04", brand: "Celestia", assignee: "riya", estimate: 3, due: day(0), priority: "high", status: "progress", completedOn: null },
    { id: "t5", name: "Celestia Static 03", brand: "Celestia", assignee: "riya", estimate: 3, due: day(0), priority: "medium", status: "completed", completedOn: today },
    { id: "t6", name: "Celestia Carousel", brand: "Celestia", assignee: "riya", estimate: 3, due: day(0), priority: "low", status: "completed", completedOn: today },
    { id: "t7", name: "Central Park Motion", brand: "Central Park", assignee: "kabir", estimate: 8, due: day(1), priority: "high", status: "progress", completedOn: null },
    { id: "t8", name: "Central Park Logo Sting", brand: "Central Park", assignee: "kabir", estimate: 2, due: day(0), priority: "medium", status: "completed", completedOn: today },
    { id: "t9", name: "Invictus Art Deco Reel", brand: "Invictus", assignee: "mehul", estimate: 6, due: day(1), priority: "high", status: "blocked", note: "Waiting for footage", completedOn: null },
    { id: "t10", name: "Invictus Print Ad", brand: "Invictus", assignee: "mehul", estimate: 4, due: day(3), priority: "low", status: "todo", completedOn: null }
  ];

  const logs = [
    { taskId: "t1", memberId: "rahul", hours: 2, date: today },
    { taskId: "t2", memberId: "rahul", hours: 1.5, date: today },
    { taskId: "t3", memberId: "rahul", hours: 3, date: today },
    { taskId: "t4", memberId: "riya", hours: 1.5, date: today },
    { taskId: "t5", memberId: "riya", hours: 2.5, date: today },
    { taskId: "t6", memberId: "riya", hours: 3, date: today },
    { taskId: "t7", memberId: "kabir", hours: 3, date: today },
    { taskId: "t8", memberId: "kabir", hours: 2, date: today },
    { taskId: "t9", memberId: "mehul", hours: 1, date: day(-1) }
  ];

  return { version: 1, team, brands, tasks, logs };
};
