/**
 * Date utilities for log components
 */

/**
 * Format a date for datetime-local input (YYYY-MM-DDThh:mm)
 */
export const formatDateForInput = (date?: Date): string => {
  if (!date) return '';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Parse datetime-local input value to Date object
 */
export const parseDateFromInput = (value: string): Date | undefined => {
  if (!value) return undefined;
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return undefined;
    }
    return date;
  } catch (e) {
    console.error('Error parsing date:', e);
    return undefined;
  }
};

/**
 * Format time bucket for chart display
 */
export const formatTimeBucket = (bucket: string): string => {
  if (!bucket) return '';
  
  try {
    const date = new Date(bucket);
    return new Intl.DateTimeFormat('ja-JP', {
      month: 'numeric', day: 'numeric',
      hour: 'numeric'
    }).format(date);
  } catch (e) {
    return bucket; // If parsing fails, return the original value
  }
};

/**
 * Get a time bucket (hourly) from a timestamp
 */
export const getTimeBucket = (timestamp: number): string => {
  const date = new Date(timestamp);
  // Set minutes and seconds to 0 to group by hour
  date.setMinutes(0, 0, 0);
  return date.toISOString();
};
