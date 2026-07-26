const API_URL = "http://localhost:3001";

export type GarageCar = {
  id: string;
  pilotId: string;
  manufacturer: string | null;
  name: string;
  simulator: string | null;
  category: string | null;
  notes: string | null;
};

export type Setup = {
  id: string;
  carId: string;
  name: string;
  brakeBias: number | null;
  frontRideHeight: number | null;
  rearRideHeight: number | null;
  frontCamber: number | null;
  rearCamber: number | null;
  frontToe: number | null;
  rearToe: number | null;
  frontARB: number | null;
  rearARB: number | null;
  frontSpring: number | null;
  rearSpring: number | null;
  diffPreload: number | null;
  notes: string | null;
};

export type CarProblem = {
  id: string;
  carId: string;
  phase: string;
  problem: string;
  severity: number | null;
  notes: string | null;
};

export async function getCars(pilotId: string) {
  const response = await fetch(`${API_URL}/api/cars?pilotId=${pilotId}`);
  return response.json() as Promise<{ items: GarageCar[] }>;
}

export async function getCar(carId: string) {
  const response = await fetch(`${API_URL}/api/cars/${carId}`);
  return response.json() as Promise<{ car: GarageCar }>;
}

export async function createCar(data: {
  pilotId: string;
  manufacturer?: string;
  name: string;
  simulator?: string;
  category?: string;
  notes?: string;
}) {
  const response = await fetch(`${API_URL}/api/cars`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return response.json();
}

export async function getSetups(carId: string) {
  const response = await fetch(`${API_URL}/api/setups?carId=${carId}`);
  return response.json() as Promise<{ items: Setup[] }>;
}

export async function createSetup(data: {
  carId: string;
  name: string;
  brakeBias?: number | null;
  frontRideHeight?: number | null;
  rearRideHeight?: number | null;
  frontCamber?: number | null;
  rearCamber?: number | null;
  frontToe?: number | null;
  rearToe?: number | null;
  frontARB?: number | null;
  rearARB?: number | null;
  frontSpring?: number | null;
  rearSpring?: number | null;
  diffPreload?: number | null;
  notes?: string | null;
}) {
  const response = await fetch(`${API_URL}/api/setups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return response.json();
}

export async function getProblems(carId: string) {
  const response = await fetch(`${API_URL}/api/problems?carId=${carId}`);
  return response.json() as Promise<{ items: CarProblem[] }>;
}

export async function createProblem(data: {
  carId: string;
  phase: string;
  problem: string;
  severity?: number | null;
  notes?: string | null;
}) {
  const response = await fetch(`${API_URL}/api/problems`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return response.json();
}
