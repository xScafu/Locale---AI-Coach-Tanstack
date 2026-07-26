export async function getDashboard() {
  const response = await fetch("http://localhost:3001/api/dashboard");

  return response.json();
}
