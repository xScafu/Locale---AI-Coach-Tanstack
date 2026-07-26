import { getDashboardData } from "../repositories/dashboard.repository";

export async function getDashboard() {
  const data = await getDashboardData();

  return {
    pilot: data.pilot,
    car: data.car,
    track: data.track,
    memory: data.memory?.summary ?? "",

    stats: {
      messages: data.messages,
      tokens: 0,
      cost: 0,
    },
  };
}
