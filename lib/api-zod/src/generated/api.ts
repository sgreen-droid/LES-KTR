Max).nullable(),
  "organizationId": zod.string(),
  "organizationName": zod.string(),
  "endpointStatus": zod.string(),
  "operatingSystem": zod.string(),
  "lastSeen": zod.string().nullable(),
  "deviceId": zod.string().nullable().describe('Action1 device identifier when reported. This is a secondary identifier; endpointId remains the canonical management key.'),
  "serialNumber": zod.string().nullable(),
  "manufacturer": zod.string().nullable(),
  "model": zod.string().nullable(),
  "isDuplicateComputerName": zod.boolean(),
  "agentVersion": zod.string().nullable(),
  "agentHealth": zod.string().nullable(),
  "recoveryStatus": zod.string().nullable(),
  "locationStatus": zod.string().nullable(),
  "locationIntegrity": zod.string().nullable(),
  "locationAgeMinutes": zod.string().nullable(),
  "locationPermission": zod.string().nullable(),
  "locationUpdated": zod.string().nullable(),
  "lastAttempt": zod.string().nullable(),
  "lastSuccess": zod.string().nullable(),
  "locationSequence": zod.string().nullable(),
  "latitude": zod.number().nullable(),
  "longitude": zod.number().nullable(),
  "accuracy": zod.string().nullable(),
  "streetAddress": zod.string().nullable(),
  "city": zod.string().nullable(),
  "state": zod.string().nullable(),
  "postalCode": zod.string().nullable(),
  "country": zod.string().nullable(),
  "addressSource": zod.string().nullable(),
  "nearestAddress": zod.string().nullable(),
  "crossStreets": zod.string().nullable(),
  "addressPrecision": zod.string().nullable(),
  "locationQuality": zod.string().nullable(),
  "locationSource": zod.string().nullable(),
  "positionSource": zod.string().nullable(),
  "locationError": zod.string().nullable(),
  "mapLink": zod.string().nullable(),
  "mapEmbedUrl": zod.string().nullable(),
  "locationCoordinates": zod.string().nullable(),
  "locationSummary": zod.string().nullable(),
  "isMapSafe": zod.boolean()
})


/**
 * @summary Get time-bounded, last-known observations for one Action1 endpoint
 */
export const getRecoveryDeviceLocationHistoryPathEndpointIdMax = 160;



export const GetRecoveryDeviceLocationHistoryParams = zod.object({
  "endpointId": zod.coerce.string().min(1).max(getRecoveryDeviceLocationHistoryPathEndpointIdMax)
})

export const GetRecoveryDeviceLocationHistoryQueryParams = zod.object({
  "from": zod.coerce.date().optional(),
  "to": zod.coerce.date().optional()
})

export const getRecoveryDeviceLocationHistoryResponseObservationCountMin = 0;



export const GetRecoveryDeviceLocationHistoryResponse = zod.object({
  "observations": zod.array(zod.object({
  "id": zod.string(),
  "endpointId": zod.string(),
  "deviceId": zod.string().nullable(),
  "computerName": zod.string(),
  "organizationId": zod.string(),
  "organizationName": zod.string(),
  "serialNumber": zod.string().nullable(),
  "manufacturer": zod.string().nullable(),
  "model": zod.string().nullable(),
  "operatingSystem": zod.string(),
  "agentVersion": zod.string().nullable(),
  "capturedAt": zod.coerce.date(),
  "sourceRefreshedAt": zod.coerce.date(),
  "locationObservedAt": zod.coerce.date().nullable(),
  "lastSeenAt": zod.coerce.date().nullable(),
  "latitude": zod.number().nullable(),
  "longitude": zod.number().nullable(),
  "accuracy": zod.string().nullable(),
  "streetAddress": zod.string().nullable(),
  "city": zod.string().nullable(),
  "state": zod.string().nullable(),
  "postalCode": zod.string().nullable(),
  "country": zod.string().nullable(),
  "addressSource": zod.string().nullable(),
  "nearestAddress": zod.string().nullable(),
  "crossStreets": zod.string().nullable(),
  "addressPrecision": zod.string().nullable(),
  "locationCoordinates": zod.string().nullable(),
  "locationStatus": zod.string().nullable(),
  "locationIntegrity": zod.string().nullable(),
  "locationQuality": zod.string().nullable(),
  "locationSource": zod.string().nullable(),
  "positionSource": zod.string().nullable(),
  "locationPermission": zod.string().nullable(),
  "locationSequence": zod.string().nullable(),
  "locationAgeMinutes": zod.string().nullable(),
  "locationError": zod.string().nullable(),
  "locationSummary": zod.string().nullable(),
  "isMapSafe": zod.boolean()
})),
  "observationCount": zod.number().min(getRecoveryDeviceLocationHistoryResponseObservationCountMin),
  "from": zod.coerce.date().nullable(),
  "to": zod.coerce.date().nullable()
})


/**
 * @summary Export time-bounded, last-known observations for one Action1 endpoint
 */
export const exportRecoveryDeviceLocationHistoryPathEndpointIdMax = 160;



export const ExportRecoveryDeviceLocationHistoryParams = zod.object({
  "endpointId": zod.coerce.string().min(1).max(exportRecoveryDeviceLocationHistoryPathEndpointIdMax)
})

export const exportRecoveryDeviceLocationHistoryQueryFormatDefault = `json`;

export const ExportRecoveryDeviceLocationHistoryQueryParams = zod.object({
  "from": zod.coerce.date().optional(),
  "to": zod.coerce.date().optional(),
  "format": zod.enum(['json', 'csv', 'print']).default(exportRecoveryDeviceLocationHistoryQueryFormatDefault)
})

export const exportRecoveryDeviceLocationHistoryResponseObservationCountMin = 0;

export const exportRecoveryDeviceLocationHistoryResponseCoverageEndpointCountMin = 0;

export const exportRecoveryDeviceLocationHistoryResponseCoverageEndpointsWithCoordinatesMin = 0;

export const exportRecoveryDeviceLocationHistoryResponseCoverageObservationCountMin = 0;

export const exportRecoveryDeviceLocationHistoryResponseCoverageCoordinateObservationCountMin = 0;

export const exportRecoveryDeviceLocationHistoryResponseCoverageMovementSegmentCountMin = 0;

export const exportRecoveryDeviceLocationHistoryResponseCoverageTotalApparentDistanceMetersMin = 0;

export const exportRecoveryDeviceLocationHistoryResponseCoverageEndpointSummariesItemObservationCountMin = 0;

export const exportRecoveryDeviceLocationHistoryResponseCoverageEndpointSummariesItemCoordinateObservationCountMin = 0;

export const exportRecoveryDeviceLocationHistoryResponseCoverageEndpointSummariesItemApparentDistanceMetersMin = 0;

export const exportRecoveryDeviceLocationHistoryResponseCoverageEndpointSummariesItemMovementSegmentCountMin = 0;

export const exportRecoveryDeviceLocationHistoryResponseCoverageEndpointSummariesItemMaxApparentSpeedKmhMin = 0;


export const exportRecoveryDeviceLocationHistoryResponseObservationsItemTwoMovementFromPreviousOneDistanceMetersMin = 0;

export const exportRecoveryDeviceLocationHistoryResponseObservationsItemTwoMovementFromPreviousOneElapsedMinutesMin = 0;

export const exportRecoveryDeviceLocationHistoryResponseObservationsItemTwoMovementFromPreviousOneApparentSpeedKmhMin = 0;



export const ExportRecoveryDeviceLocationHistoryResponse = zod.object({
  "exportId": zod.string(),
  "schemaVersion": zod.string(),
  "generatedAt": zod.coerce.date(),
  "source": zod.string(),
  "scope": zod.enum(['FLEET', 'SELECTED', 'SINGLE']),
  "endpointIds": zod.array(zod.string()),
  "from": zod.coerce.date().nullable(),
  "to": zod.coerce.date().nullable(),
  "observationCount": zod.number().min(exportRecoveryDeviceLocationHistoryResponseObservationCountMin),
  "observationOrdering": zod.enum(['GROUPED_BY_ENDPOINT_THEN_CHRONOLOGICAL_ASCENDING']),
  "coverage": zod.object({
  "endpointCount": zod.number().min(exportRecoveryDeviceLocationHistoryResponseCoverageEndpointCountMin),
  "endpointsWithCoordinates": zod.number().min(exportRecoveryDeviceLocationHistoryResponseCoverageEndpointsWithCoordinatesMin),
  "observationCount": zod.number().min(exportRecoveryDeviceLocationHistoryResponseCoverageObservationCountMin),
  "coordinateObservationCount": zod.number().min(exportRecoveryDeviceLocationHistoryResponseCoverageCoordinateObservationCountMin),
  "movementSegmentCount": zod.number().min(exportRecoveryDeviceLocationHistoryResponseCoverageMovementSegmentCountMin),
  "firstObservationAt": zod.coerce.date().nullable(),
  "lastObservationAt": zod.coerce.date().nullable(),
  "totalApparentDistanceMeters": zod.number().min(exportRecoveryDeviceLocationHistoryResponseCoverageTotalApparentDistanceMetersMin),
  "endpointSummaries": zod.array(zod.object({
  "endpointId": zod.string(),
  "deviceId": zod.string().nullable(),
  "computerNames": zod.array(zod.string()),
  "friendlyName": zod.string().nullable(),
  "organizationName": zod.string(),
  "observationCount": zod.number().min(exportRecoveryDeviceLocationHistoryResponseCoverageEndpointSummariesItemObservationCountMin),
  "coordinateObservationCount": zod.number().min(exportRecoveryDeviceLocationHistoryResponseCoverageEndpointSummariesItemCoordinateObservationCountMin),
  "firstObservationAt": zod.coerce.date().nullable(),
  "lastObservationAt": zod.coerce.date().nullable(),
  "firstCoordinate": zod.string().nullable(),
  "lastCoordinate": zod.string().nullable(),
  "apparentDistanceMeters": zod.number().min(exportRecoveryDeviceLocationHistoryResponseCoverageEndpointSummariesItemApparentDistanceMetersMin),
  "movementSegmentCount": zod.number().min(exportRecoveryDeviceLocationHistoryResponseCoverageEndpointSummariesItemMovementSegmentCountMin),
  "maxApparentSpeedKmh": zod.number().min(exportRecoveryDeviceLocationHistoryResponseCoverageEndpointSummariesItemMaxApparentSpeedKmhMin).nullable(),
  "locationStatuses": zod.array(zod.string()),
  "integrityStates": zod.array(zod.string()),
  "city": zod.string().nullable(),
  "state": zod.string().nullable(),
  "postalCode": zod.string().nullable(),
  "country": zod.string().nullable(),
  "nearestAddress": zod.string().nullable(),
  "crossStreets": zod.string().nullable()
}))
}),
  "observations": zod.array(zod.object({
  "id": zod.string(),
  "endpointId": zod.string(),
  "deviceId": zod.string().nullable(),
  "computerName": zod.string(),
  "organizationId": zod.string(),
  "organizationName": zod.string(),
  "serialNumber": zod.string().nullable(),
  "manufacturer": zod.string().nullable(),
  "model": zod.string().nullable(),
  "operatingSystem": zod.string(),
  "agentVersion": zod.string().nullable(),
  "capturedAt": zod.coerce.date(),
  "sourceRefreshedAt": zod.coerce.date(),
  "locationObservedAt": zod.coerce.date().nullable(),
  "lastSeenAt": zod.coerce.date().nullable(),
  "latitude": zod.number().nullable(),
  "longitude": zod.number().nullable(),
  "accuracy": zod.string().nullable(),
  "streetAddress": zod.string().nullable(),
  "city": zod.string().nullable(),
  "state": zod.string().nullable(),
  "postalCode": zod.string().nullable(),
  "country": zod.string().nullable(),
  "addressSource": zod.string().nullable(),
  "nearestAddress": zod.string().nullable(),
  "crossStreets": zod.string().nullable(),
  "addressPrecision": zod.string().nullable(),
  "locationCoordinates": zod.string().nullable(),
  "locationStatus": zod.string().nullable(),
  "locationIntegrity": zod.string().nullable(),
  "locationQuality": zod.string().nullable(),
  "locationSource": zod.string().nullable(),
  "positionSource": zod.string().nullable(),
  "locationPermission": zod.string().nullable(),
  "locationSequence": zod.string().nullable(),
  "locationAgeMinutes": zod.string().nullable(),
  "locationError": zod.string().nullable(),
  "locationSummary": zod.string().nullable(),
  "isMapSafe": zod.boolean()
}).and(zod.object({
  "observationNumber": zod.number().min(1),
  "friendlyName": zod.string().nullable(),
  "observationTimeBasis": zod.enum(['ENDPOINT_LOCATION_OBSERVED_AT', 'ACTION1_SOURCE_REFRESHED_AT']),
  "movementFromPrevious": zod.union([zod.object({
  "priorObservationId": zod.string(),
  "priorObservationAt": zod.coerce.date(),
  "distanceMeters": zod.number().min(exportRecoveryDeviceLocationHistoryResponseObservationsItemTwoMovementFromPreviousOneDistanceMetersMin),
  "elapsedMinutes": zod.number().min(exportRecoveryDeviceLocationHistoryResponseObservationsItemTwoMovementFromPreviousOneElapsedMinutesMin).nullable(),
  "apparentSpeedKmh": zod.number().min(exportRecoveryDeviceLocationHistoryResponseObservationsItemTwoMovementFromPreviousOneApparentSpeedKmhMin).nullable(),
  "assessment": zod.enum(['FIRST_COORDINATE', 'NO_MATERIAL_CHANGE', 'COORDINATE_CHANGE'])
}),zod.null()])
}))),
  "limitations": zod.array(zod.string())
})


/**
 * @summary List persisted last-known observations for the fleet or selected Action1 endpoints
 */
export const listRecoveryLocationHistoryQueryEndpointIdsItemMax = 160;

export const listRecoveryLocationHistoryQueryEndpointIdsMax = 50;



export const ListRecoveryLocationHistoryQueryParams = zod.object({
  "endpointIds": zod.array(zod.coerce.string().min(1).max(listRecoveryLocationHistoryQueryEndpointIdsItemMax)).max(listRecoveryLocationHistoryQueryEndpointIdsMax).optional(),
  "from": zod.coerce.date().optional(),
  "to": zod.coerce.date().optional()
})

export const listRecoveryLocationHistoryResponseObservationCountMin = 0;



export const ListRecoveryLocationHistoryResponse = zod.object({
  "observations": zod.array(zod.object({
  "id": zod.string(),
  "endpointId": zod.string(),
  "deviceId": zod.string().nullable(),
  "computerName": zod.string(),
  "organizationId": zod.string(),
  "organizationName": zod.string(),
  "serialNumber": zod.string().nullable(),
  "manufacturer": zod.string().nullable(),
  "model": zod.string().nullable(),
  "operatingSystem": zod.string(),
  "agentVersion": zod.string().nullable(),
  "capturedAt": zod.coerce.date(),
  "sourceRefreshedAt": zod.coerce.date(),
  "locationObservedAt": zod.coerce.date().nullable(),
  "lastSeenAt": zod.coerce.date().nullable(),
  "latitude": zod.number().nullable(),
  "longitude": zod.number().nullable(),
  "accuracy": zod.string().nullable(),
  "streetAddress": zod.string().nullable(),
  "city": zod.string().nullable(),
  "state": zod.string().nullable(),
  "postalCode": zod.string().nullable(),
  "country": zod.string().nullable(),
  "addressSource": zod.string().nullable(),
  "nearestAddress": zod.string().nullable(),
  "crossStreets": zod.string().nullable(),
  "addressPrecision": zod.string().nullable(),
  "locationCoordinates": zod.string().nullable(),
  "locationStatus": zod.string().nullable(),
  "locationIntegrity": zod.string().nullable(),
  "locationQuality": zod.string().nullable(),
  "locationSource": zod.string().nullable(),
  "positionSource": zod.string().nullable(),
  "locationPermission": zod.string().nullable(),
  "locationSequence": zod.string().nullable(),
  "locationAgeMinutes": zod.string().nullable(),
  "locationError": zod.string().nullable(),
  "locationSummary": zod.string().nullable(),
  "isMapSafe": zod.boolean()
})),
  "observationCount": zod.number().min(listRecoveryLocationHistoryResponseObservationCountMin),
  "from": zod.coerce.date().nullable(),
  "to": zod.coerce.date().nullable()
})


/**
 * @summary Export persisted last-known observations for the fleet or selected endpoints
 */
export const exportRecoveryLocationHistoryQueryEndpointIdsItemMax = 160;

export const exportRecoveryLocationHistoryQueryEndpointIdsMax = 50;

export const exportRecoveryLocationHistoryQueryFormatDefault = `json`;

export const ExportRecoveryLocationHistoryQueryParams = zod.object({
  "endpointIds": zod.array(zod.coerce.string().min(1).max(exportRecoveryLocationHistoryQueryEndpointIdsItemMax)).max(exportRecoveryLocationHistoryQueryEndpointIdsMax).optional(),
  "from": zod.coerce.date().optional(),
  "to": zod.coerce.date().optional(),
  "format": zod.enum(['json', 'csv', 'print']).default(exportRecoveryLocationHistoryQueryFormatDefault)
})

export const exportRecoveryLocationHistoryResponseObservationCountMin = 0;

export const exportRecoveryLocationHistoryResponseCoverageEndpointCountMin = 0;

export const exportRecoveryLocationHistoryResponseCoverageEndpointsWithCoordinatesMin = 0;

export const exportRecoveryLocationHistoryResponseCoverageObservationCountMin = 0;

export const exportRecoveryLocationHistoryResponseCoverageCoordinateObservationCountMin = 0;

export const exportRecoveryLocationHistoryResponseCoverageMovementSegmentCountMin = 0;

export const exportRecoveryLocationHistoryResponseCoverageTotalApparentDistanceMetersMin = 0;

export const exportRecoveryLocationHistoryResponseCoverageEndpointSummariesItemObservationCountMin = 0;

export const exportRecoveryLocationHistoryResponseCoverageEndpointSummariesItemCoordinateObservationCountMin = 0;

export const exportRecoveryLocationHistoryResponseCoverageEndpointSummariesItemApparentDistanceMetersMin = 0;

export const exportRecoveryLocationHistoryResponseCoverageEndpointSummariesItemMovementSegmentCountMin = 0;

export const exportRecoveryLocationHistoryResponseCoverageEndpointSummariesItemMaxApparentSpeedKmhMin = 0;


export const exportRecoveryLocationHistoryResponseObservationsItemTwoMovementFromPreviousOneDistanceMetersMin = 0;

export const exportRecoveryLocationHistoryResponseObservationsItemTwoMovementFromPreviousOneElapsedMinutesMin = 0;

export const exportRecoveryLocationHistoryResponseObservationsItemTwoMovementFromPreviousOneApparentSpeedKmhMin = 0;



export const ExportRecoveryLocationHistoryResponse = zod.object({
  "exportId": zod.string(),
  "schemaVersion": zod.string(),
  "generatedAt": zod.coerce.date(),
  "source": zod.string(),
  "scope": zod.enum(['FLEET', 'SELECTED', 'SINGLE']),
  "endpointIds": zod.array(zod.string()),
  "from": zod.coerce.date().nullable(),
  "to": zod.coerce.date().nullable(),
  "observationCount": zod.number().min(exportRecoveryLocationHistoryResponseObservationCountMin),
  "observationOrdering": zod.enum(['GROUPED_BY_ENDPOINT_THEN_CHRONOLOGICAL_ASCENDING']),
  "coverage": zod.object({
  "endpointCount": zod.number().min(exportRecoveryLocationHistoryResponseCoverageEndpointCountMin),
  "endpointsWithCoordinates": zod.number().min(exportRecoveryLocationHistoryResponseCoverageEndpointsWithCoordinatesMin),
  "observationCount": zod.number().min(exportRecoveryLocationHistoryResponseCoverageObservationCountMin),
  "coordinateObservationCount": zod.number().min(exportRecoveryLocationHistoryResponseCoverageCoordinateObservationCountMin),
  "movementSegmentCount": zod.number().min(exportRecoveryLocationHistoryResponseCoverageMovementSegmentCountMin),
  "firstObservationAt": zod.coerce.date().nullable(),
  "lastObservationAt": zod.coerce.date().nullable(),
  "totalApparentDistanceMeters": zod.number().min(exportRecoveryLocationHistoryResponseCoverageTotalApparentDistanceMetersMin),
  "endpointSummaries": zod.array(zod.object({
  "endpointId": zod.string(),
  "deviceId": zod.string().nullable(),
  "computerNames": zod.array(zod.string()),
  "friendlyName": zod.string().nullable(),
  "organizationName": zod.string(),
  "observationCount": zod.number().min(exportRecoveryLocationHistoryResponseCoverageEndpointSummariesItemObservationCountMin),
  "coordinateObservationCount": zod.number().min(exportRecoveryLocationHistoryResponseCoverageEndpointSummariesItemCoordinateObservationCountMin),
  "firstObservationAt": zod.coerce.date().nullable(),
  "lastObservationAt": zod.coerce.date().nullable(),
  "firstCoordinate": zod.string().nullable(),
  "lastCoordinate": zod.string().nullable(),
  "apparentDistanceMeters": zod.number().min(exportRecoveryLocationHistoryResponseCoverageEndpointSummariesItemApparentDistanceMetersMin),
  "movementSegmentCount": zod.number().min(exportRecoveryLocationHistoryResponseCoverageEndpointSummariesItemMovementSegmentCountMin),
  "maxApparentSpeedKmh": zod.number().min(exportRecoveryLocationHistoryResponseCoverageEndpointSummariesItemMaxApparentSpeedKmhMin).nullable(),
  "locationStatuses": zod.array(zod.string()),
  "integrityStates": zod.array(zod.string()),
  "city": zod.string().nullable(),
  "state": zod.string().nullable(),
  "postalCode": zod.string().nullable(),
  "country": zod.string().nullable(),
  "nearestAddress": zod.string().nullable(),
  "crossStreets": zod.string().nullable()
}))
}),
  "observations": zod.array(zod.object({
  "id": zod.string(),
  "endpointId": zod.string(),
  "deviceId": zod.string().nullable(),
  "computerName": zod.string(),
  "organizationId": zod.string(),
  "organizationName": zod.string(),
  "serialNumber": zod.string().nullable(),
  "manufacturer": zod.string().nullable(),
  "model": zod.string().nullable(),
  "operatingSystem": zod.string(),
  "agentVersion": zod.string().nullable(),
  "capturedAt": zod.coerce.date(),
  "sourceRefreshedAt": zod.coerce.date(),
  "locationObservedAt": zod.coerce.date().nullable(),
  "lastSeenAt": zod.coerce.date().nullable(),
  "latitude": zod.number().nullable(),
  "longitude": zod.number().nullable(),
  "accuracy": zod.string().nullable(),
  "streetAddress": zod.string().nullable(),
  "city": zod.string().nullable(),
  "state": zod.string().nullable(),
  "postalCode": zod.string().nullable(),
  "country": zod.string().nullable(),
  "addressSource": zod.string().nullable(),
  "nearestAddress": zod.string().nullable(),
  "crossStreets": zod.string().nullable(),
  "addressPrecision": zod.string().nullable(),
  "locationCoordinates": zod.string().nullable(),
  "locationStatus": zod.string().nullable(),
  "locationIntegrity": zod.string().nullable(),
  "locationQuality": zod.string().nullable(),
  "locationSource": zod.string().nullable(),
  "positionSource": zod.string().nullable(),
  "locationPermission": zod.string().nullable(),
  "locationSequence": zod.string().nullable(),
  "locationAgeMinutes": zod.string().nullable(),
  "locationError": zod.string().nullable(),
  "locationSummary": zod.string().nullable(),
  "isMapSafe": zod.boolean()
}).and(zod.object({
  "observationNumber": zod.number().min(1),
  "friendlyName": zod.string().nullable(),
  "observationTimeBasis": zod.enum(['ENDPOINT_LOCATION_OBSERVED_AT', 'ACTION1_SOURCE_REFRESHED_AT']),
  "movementFromPrevious": zod.union([zod.object({
  "priorObservationId": zod.string(),
  "priorObservationAt": zod.coerce.date(),
  "distanceMeters": zod.number().min(exportRecoveryLocationHistoryResponseObservationsItemTwoMovementFromPreviousOneDistanceMetersMin),
  "elapsedMinutes": zod.number().min(exportRecoveryLocationHistoryResponseObservationsItemTwoMovementFromPreviousOneElapsedMinutesMin).nullable(),
  "apparentSpeedKmh": zod.number().min(exportRecoveryLocationHistoryResponseObservationsItemTwoMovementFromPreviousOneApparentSpeedKmhMin).nullable(),
  "assessment": zod.enum(['FIRST_COORDINATE', 'NO_MATERIAL_CHANGE', 'COORDINATE_CHANGE'])
}),zod.null()])
}))),
  "limitations": zod.array(zod.string())
})


/**
 * @summary List recovery incidents
 */
export const listRecoveryIncidentsResponseIncidentsItemEndpointCountMin = 0;



export const ListRecoveryIncidentsResponse = zod.object({
  "incidents": zod.array(zod.object({
  "id": zod.string(),
  "title": zod.string(),
  "caseNumber": zod.string().nullable(),
  "owner": zod.string().nullable(),
  "status": zod.enum(['OPEN', 'ESCALATED', 'RECOVERED', 'CLOSED']),
  "reportedAt": zod.coerce.date(),
  "resolvedAt": zod.coerce.date().nullable(),
  "createdAt": zod.coerce.date(),
  "updatedAt": zod.coerce.date(),
  "endpointCount": zod.number().min(listRecoveryIncidentsResponseIncidentsItemEndpointCountMin)
}))
})


/**
 * @summary Create an incident and capture current endpoint evidence
 */
export const createRecoveryIncidentBodyTitleMin = 3;
export const createRecoveryIncidentBodyTitleMax = 160;

export const createRecoveryIncidentBodyEndpointIdsItemMax = 160;

export const createRecoveryIncidentBodyEndpointIdsMax = 50;

export const createRecoveryIncidentBodyCaseNumberMax = 100;

export const createRecoveryIncidentBodyOwnerMax = 100;

export const createRecoveryIncidentBodyNoteMax = 4000;



export const CreateRecoveryIncidentBody = zod.object({
  "title": zod.string().min(createRecoveryIncidentBodyTitleMin).max(createRecoveryIncidentBodyTitleMax),
  "endpointIds": zod.array(zod.string().min(1).max(createRecoveryIncidentBodyEndpointIdsItemMax)).min(1).max(createRecoveryIncidentBodyEndpointIdsMax),
  "caseNumber": zod.string().max(createRecoveryIncidentBodyCaseNumberMax).nullish(),
  "owner": zod.string().max(createRecoveryIncidentBodyOwnerMax).nullish(),
  "reportedAt": zod.coerce.date().nullish(),
  "note": zod.string().max(createRecoveryIncidentBodyNoteMax).nullish()
})

export const createRecoveryIncidentResponseOneEndpointCountMin = 0;

export const createRecoveryIncidentResponseTwoEvidenceItemDeviceFriendlyNameMax = 120;



export const CreateRecoveryIncidentResponse = zod.object({
  "id": zod.string(),
  "title": zod.string(),
  "caseNumber": zod.string().nullable(),
  "owner": zod.string().nullable(),
  "status": zod.enum(['OPEN', 'ESCALATED', 'RECOVERED', 'CLOSED']),
  "reportedAt": zod.coerce.date(),
  "resolvedAt": zod.coerce.date().nullable(),
  "createdAt": zod.coerce.date(),
  "updatedAt": zod.coerce.date(),
  "endpointCount": zod.number().min(createRecoveryIncidentResponseOneEndpointCountMin)
}).and(zod.object({
  "evidence": zod.array(zod.object({
  "endpointId": zod.string(),
  "organizationId": zod.string(),
  "organizationName": zod.string(),
  "capturedAt": zod.coerce.date(),
  "sourceRefreshedAt": zod.coerce.date(),
  "device": zod.object({
  "endpointId": zod.string(),
  "computerName": zod.string(),
  "friendlyName": zod.string().max(createRecoveryIncidentResponseTwoEvidenceItemDeviceFriendlyNameMax).nullable(),
  "organizationId": zod.string(),
  "organizationName": zod.string(),
  "endpointStatus": zod.string(),
  "operatingSystem": zod.string(),
  "lastSeen": zod.string().nullable(),
  "deviceId": zod.string().nullable().describe('Action1 device identifier when reported. This is a secondary identifier; endpointId remains the canonical management key.'),
  "serialNumber": zod.string().nullable(),
  "manufacturer": zod.string().nullable(),
  "model": zod.string().nullable(),
  "isDuplicateComputerName": zod.boolean(),
  "agentVersion": zod.string().nullable(),
  "agentHealth": zod.string().nullable(),
  "recoveryStatus": zod.string().nullable(),
  "locationStatus": zod.string().nullable(),
  "locationIntegrity": zod.string().nullable(),
  "locationAgeMinutes": zod.string().nullable(),
  "locationPermission": zod.string().nullable(),
  "locationUpdated": zod.string().nullable(),
  "lastAttempt": zod.string().nullable(),
  "lastSuccess": zod.string().nullable(),
  "locationSequence": zod.string().nullable(),
  "latitude": zod.number().nullable(),
  "longitude": zod.number().nullable(),
  "accuracy": zod.string().nullable(),
  "streetAddress": zod.string().nullable(),
  "city": zod.string().nullable(),
  "state": zod.string().nullable(),
  "postalCode": zod.string().nullable(),
  "country": zod.string().nullable(),
  "addressSource": zod.string().nullable(),
  "nearestAddress": zod.string().nullable(),
  "crossStreets": zod.string().nullable(),
  "addressPrecision": zod.string().nullable(),
  "locationQuality": zod.string().nullable(),
  "locationSource": zod.string().nullable(),
  "positionSource": zod.string().nullable(),
  "locationError": zod.string().nullable(),
  "mapLink": zod.string().nullable(),
  "mapEmbedUrl": zod.string().nullable(),
  "locationCoordinates": zod.string().nullable(),
  "locationSummary": zod.string().nullable(),
  "isMapSafe": zod.boolean()
})
})),
  "audit": zod.array(zod.object({
  "id": zod.string(),
  "eventType": zod.string(),
  "actorLabel": zod.string(),
  "summary": zod.string(),
  "endpointId": zod.string().nullable(),
  "occurredAt": zod.coerce.date()
}))
}))


/**
 * @summary Get an incident with captured endpoint evidence and audit records
 */
export const GetRecoveryIncidentParams = zod.object({
  "incidentId": zod.coerce.string()
})

export const getRecoveryIncidentResponseOneEndpointCountMin = 0;

export const getRecoveryIncidentResponseTwoEvidenceItemDeviceFriendlyNameMax = 120;



export const GetRecoveryIncidentResponse = zod.object({
  "id": zod.string(),
  "title": zod.string(),
  "caseNumber": zod.string().nullable(),
  "owner": zod.string().nullable(),
  "status": zod.enum(['OPEN', 'ESCALATED', 'RECOVERED', 'CLOSED']),
  "reportedAt": zod.coerce.date(),
  "resolvedAt": zod.coerce.date().nullable(),
  "createdAt": zod.coerce.date(),
  "updatedAt": zod.coerce.date(),
  "endpointCount": zod.number().min(getRecoveryIncidentResponseOneEndpointCountMin)
}).and(zod.object({
  "evidence": zod.array(zod.object({
  "endpointId": zod.string(),
  "organizationId": zod.string(),
  "organizationName": zod.string(),
  "capturedAt": zod.coerce.date(),
  "sourceRefreshedAt": zod.coerce.date(),
  "device": zod.object({
  "endpointId": zod.string(),
  "computerName": zod.string(),
  "friendlyName": zod.string().max(getRecoveryIncidentResponseTwoEvidenceItemDeviceFriendlyNameMax).nullable(),
  "organizationId": zod.string(),
  "organizationName": zod.string(),
  "endpointStatus": zod.string(),
  "operatingSystem": zod.string(),
  "lastSeen": zod.string().nullable(),
  "deviceId": zod.string().nullable().describe('Action1 device identifier when reported. This is a secondary identifier; endpointId remains the canonical management key.'),
  "serialNumber": zod.string().nullable(),
  "manufacturer": zod.string().nullable(),
  "model": zod.string().nullable(),
  "isDuplicateComputerName": zod.boolean(),
  "agentVersion": zod.string().nullable(),
  "agentHealth": zod.string().nullable(),
  "recoveryStatus": zod.string().nullable(),
  "locationStatus": zod.string().nullable(),
  "locationIntegrity": zod.string().nullable(),
  "locationAgeMinutes": zod.string().nullable(),
  "locationPermission": zod.string().nullable(),
  "locationUpdated": zod.string().nullable(),
  "lastAttempt": zod.string().nullable(),
  "lastSuccess": zod.string().nullable(),
  "locationSequence": zod.string().nullable(),
  "latitude": zod.number().nullable(),
  "longitude": zod.number().nullable(),
  "accuracy": zod.string().nullable(),
  "streetAddress": zod.string().nullable(),
  "city": zod.string().nullable(),
  "state": zod.string().nullable(),
  "postalCode": zod.string().nullable(),
  "country": zod.string().nullable(),
  "addressSource": zod.string().nullable(),
  "nearestAddress": zod.string().nullable(),
  "crossStreets": zod.string().nullable(),
  "addressPrecision": zod.string().nullable(),
  "locationQuality": zod.string().nullable(),
  "locationSource": zod.string().nullable(),
  "positionSource": zod.string().nullable(),
  "locationError": zod.string().nullable(),
  "mapLink": zod.string().nullable(),
  "mapEmbedUrl": zod.string().nullable(),
  "locationCoordinates": zod.string().nullable(),
  "locationSummary": zod.string().nullable(),
  "isMapSafe": zod.boolean()
})
})),
  "audit": zod.array(zod.object({
  "id": zod.string(),
  "eventType": zod.string(),
  "actorLabel": zod.string(),
  "summary": zod.string(),
  "endpointId": zod.string().nullable(),
  "occurredAt": zod.coerce.date()
}))
}))


/**
 * @summary Update incident ownership, status, case information, or add a note
 */
export const UpdateRecoveryIncidentParams = zod.object({
  "incidentId": zod.coerce.string()
})

export const updateRecoveryIncidentBodyTitleMin = 3;
export const updateRecoveryIncidentBodyTitleMax = 160;

export const updateRecoveryIncidentBodyCaseNumberMax = 100;

export const updateRecoveryIncidentBodyOwnerMax = 100;

export const updateRecoveryIncidentBodyNoteMax = 4000;



export const UpdateRecoveryIncidentBody = zod.object({
  "title": zod.string().min(updateRecoveryIncidentBodyTitleMin).max(updateRecoveryIncidentBodyTitleMax).optional(),
  "caseNumber": zod.string().max(updateRecoveryIncidentBodyCaseNumberMax).nullish(),
  "owner": zod.string().max(updateRecoveryIncidentBodyOwnerMax).nullish(),
  "status": zod.enum(['OPEN', 'ESCALATED', 'RECOVERED', 'CLOSED']).optional(),
  "note": zod.string().min(1).max(updateRecoveryIncidentBodyNoteMax).optional()
})

export const updateRecoveryIncidentResponseOneEndpointCountMin = 0;

export const updateRecoveryIncidentResponseTwoEvidenceItemDeviceFriendlyNameMax = 120;



export const UpdateRecoveryIncidentResponse = zod.object({
  "id": zod.string(),
  "title": zod.string(),
  "caseNumber": zod.string().nullable(),
  "owner": zod.string().nullable(),
  "status": zod.enum(['OPEN', 'ESCALATED', 'RECOVERED', 'CLOSED']),
  "reportedAt": zod.coerce.date(),
  "resolvedAt": zod.coerce.date().nullable(),
  "createdAt": zod.coerce.date(),
  "updatedAt": zod.coerce.date(),
  "endpointCount": zod.number().min(updateRecoveryIncidentResponseOneEndpointCountMin)
}).and(zod.object({
  "evidence": zod.array(zod.object({
  "endpointId": zod.string(),
  "organizationId": zod.string(),
  "organizationName": zod.string(),
  "capturedAt": zod.coerce.date(),
  "sourceRefreshedAt": zod.coerce.date(),
  "device": zod.object({
  "endpointId": zod.string(),
  "computerName": zod.string(),
  "friendlyName": zod.string().max(updateRecoveryIncidentResponseTwoEvidenceItemDeviceFriendlyNameMax).nullable(),
  "organizationId": zod.string(),
  "organizationName": zod.string(),
  "endpointStatus": zod.string(),
  "operatingSystem": zod.string(),
  "lastSeen": zod.string().nullable(),
  "deviceId": zod.string().nullable().describe('Action1 device identifier when reported. This is a secondary identifier; endpointId remains the canonical management key.'),
  "serialNumber": zod.string().nullable(),
  "manufacturer": zod.string().nullable(),
  "model": zod.string().nullable(),
  "isDuplicateComputerName": zod.boolean(),
  "agentVersion": zod.string().nullable(),
  "agentHealth": zod.string().nullable(),
  "recoveryStatus": zod.string().nullable(),
  "locationStatus": zod.string().nullable(),
  "locationIntegrity": zod.string().nullable(),
  "locationAgeMinutes": zod.string().nullable(),
  "locationPermission": zod.string().nullable(),
  "locationUpdated": zod.string().nullable(),
  "lastAttempt": zod.string().nullable(),
  "lastSuccess": zod.string().nullable(),
  "locationSequence": zod.string().nullable(),
  "latitude": zod.number().nullable(),
  "longitude": zod.number().nullable(),
  "accuracy": zod.string().nullable(),
  "streetAddress": zod.string().nullable(),
  "city": zod.string().nullable(),
  "state": zod.string().nullable(),
  "postalCode": zod.string().nullable(),
  "country": zod.string().nullable(),
  "addressSource": zod.string().nullable(),
  "nearestAddress": zod.string().nullable(),
  "crossStreets": zod.string().nullable(),
  "addressPrecision": zod.string().nullable(),
  "locationQuality": zod.string().nullable(),
  "locationSource": zod.string().nullable(),
  "positionSource": zod.string().nullable(),
  "locationError": zod.string().nullable(),
  "mapLink": zod.string().nullable(),
  "mapEmbedUrl": zod.string().nullable(),
  "locationCoordinates": zod.string().nullable(),
  "locationSummary": zod.string().nullable(),
  "isMapSafe": zod.boolean()
})
})),
  "audit": zod.array(zod.object({
  "id": zod.string(),
  "eventType": zod.string(),
  "actorLabel": zod.string(),
  "summary": zod.string(),
  "endpointId": zod.string().nullable(),
  "occurredAt": zod.coerce.date()
}))
}))


/**
 * @summary Generate a controlled incident evidence export
 */
export const ExportRecoveryIncidentParams = zod.object({
  "incidentId": zod.coerce.string()
})

export const ExportRecoveryIncidentBody = zod.object({
  "format": zod.enum(['json', 'csv', 'print'])
})

export const exportRecoveryIncidentResponseIncidentOneEndpointCountMin = 0;

export const exportRecoveryIncidentResponseIncidentTwoEvidenceItemDeviceFriendlyNameMax = 120;



export const ExportRecoveryIncidentResponse = zod.object({
  "exportId": zod.string(),
  "schemaVersion": zod.string(),
  "generatedAt": zod.coerce.date(),
  "source": zod.string(),
  "incident": zod.object({
  "id": zod.string(),
  "title": zod.string(),
  "caseNumber": zod.string().nullable(),
  "owner": zod.string().nullable(),
  "status": zod.enum(['OPEN', 'ESCALATED', 'RECOVERED', 'CLOSED']),
  "reportedAt": zod.coerce.date(),
  "resolvedAt": zod.coerce.date().nullable(),
  "createdAt": zod.coerce.date(),
  "updatedAt": zod.coerce.date(),
  "endpointCount": zod.number().min(exportRecoveryIncidentResponseIncidentOneEndpointCountMin)
}).and(zod.object({
  "evidence": zod.array(zod.object({
  "endpointId": zod.string(),
  "organizationId": zod.string(),
  "organizationName": zod.string(),
  "capturedAt": zod.coerce.date(),
  "sourceRefreshedAt": zod.coerce.date(),
  "device": zod.object({
  "endpointId": zod.string(),
  "computerName": zod.string(),
  "friendlyName": zod.string().max(exportRecoveryIncidentResponseIncidentTwoEvidenceItemDeviceFriendlyNameMax).nullable(),
  "organizationId": zod.string(),
  "organizationName": zod.string(),
  "endpointStatus": zod.string(),
  "operatingSystem": zod.string(),
  "lastSeen": zod.string().nullable(),
  "deviceId": zod.string().nullable().describe('Action1 device identifier when reported. This is a secondary identifier; endpointId remains the canonical management key.'),
  "serialNumber": zod.string().nullable(),
  "manufacturer": zod.string().nullable(),
  "model": zod.string().nullable(),
  "isDuplicateComputerName": zod.boolean(),
  "agentVersion": zod.string().nullable(),
  "agentHealth": zod.string().nullable(),
  "recoveryStatus": zod.string().nullable(),
  "locationStatus": zod.string().nullable(),
  "locationIntegrity": zod.string().nullable(),
  "locationAgeMinutes": zod.string().nullable(),
  "locationPermission": zod.string().nullable(),
  "locationUpdated": zod.string().nullable(),
  "lastAttempt": zod.string().nullable(),
  "lastSuccess": zod.string().nullable(),
  "locationSequence": zod.string().nullable(),
  "latitude": zod.number().nullable(),
  "longitude": zod.number().nullable(),
  "accuracy": zod.string().nullable(),
  "streetAddress": zod.string().nullable(),
  "city": zod.string().nullable(),
  "state": zod.string().nullable(),
  "postalCode": zod.string().nullable(),
  "country": zod.string().nullable(),
  "addressSource": zod.string().nullable(),
  "nearestAddress": zod.string().nullable(),
  "crossStreets": zod.string().nullable(),
  "addressPrecision": zod.string().nullable(),
  "locationQuality": zod.string().nullable(),
  "locationSource": zod.string().nullable(),
  "positionSource": zod.string().nullable(),
  "locationError": zod.string().nullable(),
  "mapLink": zod.string().nullable(),
  "mapEmbedUrl": zod.string().nullable(),
  "locationCoordinates": zod.string().nullable(),
  "locationSummary": zod.string().nullable(),
  "isMapSafe": zod.boolean()
})
})),
  "audit": zod.array(zod.object({
  "id": zod.string(),
  "eventType": zod.string(),
  "actorLabel": zod.string(),
  "summary": zod.string(),
  "endpointId": zod.string().nullable(),
  "occurredAt": zod.coerce.date()
}))
})),
  "limitations": zod.array(zod.string())
})


