import os
import random
import math
from datetime import datetime, timedelta, timezone
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

URL = os.environ["INFLUXDB_URL"]
TOKEN = os.environ["INFLUXDB_TOKEN"]
ORG = os.environ["INFLUXDB_ORG"]
BUCKET = os.environ["INFLUXDB_BUCKET"]

NODES = ["0x433aad0c", "0x333aeb14", "0x522bfc08"]
STALE_NODE = "0x522bfc08"
STALE_GAP_MINUTES = 30

INTERVAL_MINUTES = 5
HOURS_OF_DATA = 24
BATCH_SIZE = 500
MEASUREMENT = "telemetry"


def _hour_frac(t: datetime) -> float:
    return (t.hour + t.minute / 60.0) / 24.0


def _radio_fields(t):
    """Common radio/mesh fields present in every packet type."""
    return {
        "rxSnr": round(random.uniform(-25, 10), 2),
        "rxRssi": round(random.uniform(-120, -50), 0),
        "rxTime": float(int(t.timestamp())),
        "hopStart": float(random.choice([2, 3, 4])),
        "hopLimit": float(random.choice([1, 2, 3])),
    }


def _device_metrics(t):
    """batteryLevel, voltage, channelUtilization, airUtilTx."""
    h = _hour_frac(t)
    return {
        "batteryLevel": round(max(0.0, min(100.0, 85.0 - 15.0 * h + random.uniform(-2, 2))), 1),
        "voltage": round(3.7 + 0.5 * (1.0 - h) + random.uniform(-0.05, 0.05), 3),
        "channelUtilization": round(15.0 + 10.0 * math.sin(h * math.pi * 2) + random.uniform(-2, 2), 3),
        "airUtilTx": round(2.0 + 3.0 * math.sin(h * math.pi) + random.uniform(-0.5, 0.5), 4),
    }


def _particulate_matter(t):
    """PM standard and environmental readings."""
    h = _hour_frac(t)
    base_pm10 = 8.0 + 6.0 * math.sin(h * math.pi * 2)
    base_pm25 = 11.0 + 8.0 * math.sin(h * math.pi * 2)
    base_pm100 = 14.0 + 10.0 * math.sin(h * math.pi * 1.5)
    return {
        "pm10Standard": round(max(0.0, base_pm10 + random.uniform(-1, 1)), 0),
        "pm25Standard": round(max(0.0, base_pm25 + random.uniform(-1, 1)), 0),
        "pm100Standard": round(max(0.0, base_pm100 + random.uniform(-2, 2)), 0),
        "pm10Environmental": round(max(0.0, base_pm10 * 1.05 + random.uniform(-1, 1)), 0),
        "pm25Environmental": round(max(0.0, base_pm25 * 1.05 + random.uniform(-1, 1)), 0),
        "pm100Environmental": round(max(0.0, base_pm100 * 1.05 + random.uniform(-2, 2)), 0),
    }


def _environmental(t):
    """Temperature, humidity, pressure, gas, IAQ, wind."""
    h = _hour_frac(t)
    return {
        "temperature": round(14.0 + 8.0 * math.sin((h - 0.25) * math.pi) + random.uniform(-0.5, 0.5), 2),
        "relativeHumidity": round(55.0 + 20.0 * math.sin(h * math.pi * 2) + random.uniform(-2, 2), 2),
        "barometricPressure": round(970.0 + 10.0 * math.sin(h * math.pi) + random.uniform(-1, 1), 2),
        "gasResistance": round(350.0 + 100.0 * math.sin(h * math.pi) + random.uniform(-20, 20), 2),
        "iaq": round(max(0.0, 100.0 + 80.0 * math.sin(h * math.pi * 2) + random.uniform(-10, 10)), 0),
        "windDirection": round((180.0 + 120.0 * math.sin(h * math.pi * 2) + random.uniform(-15, 15)) % 360, 0),
        "windSpeed": round(max(0.0, 1.0 + 3.0 * math.sin(h * math.pi) + random.uniform(-0.3, 0.3)), 2),
    }


# Packet types written per interval. Each entry pairs a field generator with
# a minute offset so that the three packet types for one "tick" land on
# distinct timestamps (simulating separate radio arrivals).
PACKET_TYPES = [
    (0, _device_metrics),
    (1, _particulate_matter),
    (2, _environmental),
]


def _make_point(node: str, t: datetime, fields: dict) -> Point:
    p = Point(MEASUREMENT).tag("node", node).time(t, WritePrecision.S)
    for k, v in fields.items():
        p = p.field(k, float(v))
    return p


def generate_points():
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=HOURS_OF_DATA)
    stale_cutoff = now - timedelta(minutes=STALE_GAP_MINUTES)
    points = []

    for node in NODES:
        t = start
        while t <= now:
            if node == STALE_NODE and t > stale_cutoff:
                t += timedelta(minutes=INTERVAL_MINUTES)
                continue

            radio = _radio_fields(t)
            for offset_min, make_fields in PACKET_TYPES:
                pt_time = t + timedelta(minutes=offset_min)
                points.append(_make_point(node, pt_time, {**make_fields(t), **radio}))

            t += timedelta(minutes=INTERVAL_MINUTES)

    return points


def write_points(client: InfluxDBClient, points):
    write_api = client.write_api(write_options=SYNCHRONOUS)
    for i in range(0, len(points), BATCH_SIZE):
        batch = points[i : i + BATCH_SIZE]
        write_api.write(bucket=BUCKET, record=batch)
        print(f"  Wrote batch {i // BATCH_SIZE + 1} ({len(batch)} points)")


def main():
    print(f"Connecting to InfluxDB at {URL}...")
    client = InfluxDBClient(url=URL, token=TOKEN, org=ORG)

    print("Generating sample telemetry data...")
    points = generate_points()
    print(f"Writing {len(points)} data points for {len(NODES)} nodes...")

    write_points(client, points)

    print("Seed complete.")
    client.close()


if __name__ == "__main__":
    main()
