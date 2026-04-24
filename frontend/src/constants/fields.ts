// Field names match the Meshtastic CSV exports written into the `environment`
// measurement. Three packet types share the bucket and are distinguished by
// the `sensor` tag (environmentMetrics / powerMetrics / airQualityMetrics);
// shared radio fields (rxSnr, rxRssi, rxTime, hopStart, hopLimit) appear
// across all of them.

export const FIELD_LABELS: Record<string, string> = {
  temperature: "Temp",
  relativeHumidity: "Humidity",
  barometricPressure: "Pressure",
  gasResistance: "Gas Res",
  iaq: "IAQ",
  windDirection: "Wind Direction",
  windSpeed: "Wind Speed",
  pm10Standard: "PM1.0",
  pm25Standard: "PM2.5",
  pm100Standard: "PM10",
  pm10Environmental: "PM1.0 Env",
  pm25Environmental: "PM2.5 Env",
  pm100Environmental: "PM10 Env",
  ch3Voltage: "Voltage",
  ch3Current: "Current",
  rxSnr: "SNR",
  rxRssi: "RSSI",
  rxTime: "Rx Time",
  hopStart: "Hop Start",
  hopLimit: "Hop Limit",
};

export const FIELD_UNITS: Record<string, string> = {
  temperature: "\u00B0C",
  relativeHumidity: "%",
  barometricPressure: " hPa",
  gasResistance: " \u03A9",
  iaq: "",
  windDirection: "\u00B0",
  windSpeed: " m/s",
  pm10Standard: " \u00B5g/m\u00B3",
  pm25Standard: " \u00B5g/m\u00B3",
  pm100Standard: " \u00B5g/m\u00B3",
  pm10Environmental: " \u00B5g/m\u00B3",
  pm25Environmental: " \u00B5g/m\u00B3",
  pm100Environmental: " \u00B5g/m\u00B3",
  ch3Voltage: " V",
  ch3Current: " mA",
  rxSnr: " dB",
  rxRssi: " dBm",
  rxTime: "",
  hopStart: "",
  hopLimit: "",
};

export const HEADER_FIELDS = [
  "temperature",
  "relativeHumidity",
  "pm25Standard",
  "ch3Voltage",
];

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export function formatFieldValue(field: string, value: number): string {
  return `${value}${FIELD_UNITS[field] ?? ""}`;
}
