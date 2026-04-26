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
  batteryLevel: "Battery",
  voltage: "Voltage",
  channelUtilization: "Ch Util",
  airUtilTx: "Air Util",
  rxSnr: "SNR",
  rxRssi: "RSSI",
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
  batteryLevel: "%",
  voltage: " V",
  channelUtilization: "%",
  airUtilTx: "%",
  rxSnr: " dB",
  rxRssi: " dBm",
};

export const HEADER_FIELDS = [
  "pm100Standard",
  "pm25Standard",
  "windSpeed",
  "windDirection",
  "voltage",
];

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export function formatFieldValue(field: string, value: number): string {
  return `${value}${FIELD_UNITS[field] ?? ""}`;
}
