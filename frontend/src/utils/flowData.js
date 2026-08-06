export function formatNumber(value, digits = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return number.toFixed(digits);
}

export function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function stationSlug(station) {
  return String(
    station?.id || station?.kode_station || station?.station_name || "",
  ).trim();
}

export function readingToRow(station, reading) {
  const is_new_schema = reading?.flow_avg !== undefined;

  if (is_new_schema) {
    return {
      id:             reading?.id,
      stationId:      station?.id,
      stationName:
        station?.station_name ||
        reading?.nama_station ||
        station?.kode_station ||
        "-",
      stationCode:    station?.kode_station || "-",
      flow_avg:       Number(reading?.flow_avg ?? null),
      velocity_avg:   Number(reading?.velocity_avg ?? null),
      totalizer_end:  Number(reading?.totalizer_end ?? null),
      vcc_last:       Number(reading?.vcc_last ?? null),
      battery_last:   Number(reading?.battery_last ?? null),
      vout_solar_last: Number(reading?.vout_solar_last ?? null),
      unit_total:     Number(reading?.unit_total ?? null),
      datetime:       reading?.datetime,
      schema:         "new",
    };
  }

  return {
    id:          reading?.id,
    stationId:   station?.id,
    stationName:
      station?.station_name ||
      reading?.nama_station ||
      station?.kode_station ||
      "-",
    stationCode:  station?.kode_station || "-",
    flow1:        Number(reading?.flow_1 || 0),
    flow2:        Number(reading?.flow_2 || 0),
    totalizer1:   Number(reading?.totalizer_1 || 0),
    totalizer2:   Number(reading?.totalizer_2 || 0),
    vcc:          Number(reading?.vcc || 0),
    temp:         Number(reading?.logger_temp || 0),
    humid:        Number(reading?.logger_humid || 0),
    datetime:     reading?.datetime,
    schema:       "old",
  };
}
