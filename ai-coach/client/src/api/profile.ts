export async function getProfile() {
  const response = await fetch("http://localhost:3001/api/profile");

  return response.json();
}
