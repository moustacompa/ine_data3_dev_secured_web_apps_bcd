export function datasetError(error) {
  const data = error?.response?.data;
  return data?.error?.message || data?.message || error?.message || 'Une erreur est survenue.';
}
export function displayValue(value) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}
