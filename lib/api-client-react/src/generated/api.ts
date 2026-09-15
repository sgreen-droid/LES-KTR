/**
 * @summary Get one recovery endpoint with labeled location details
 */

export function useGetRecoveryDevice<TData = Awaited<ReturnType<typeof getRecoveryDevice>>, TError = ErrorType<UnauthorizedResponse | ApiError | Action1UnavailableResponse>>(
 endpointId: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getRecoveryDevice>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetRecoveryDeviceQueryOptions(endpointId,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getUpdateRecoveryDeviceAliasUrl = (endpointId: string,) => {




  return `/api/recovery/devices/${endpointId}`
}

/**
 * @summary Set or clear the friendly name for one recovery endpoint
 */
export const updateRecoveryDeviceAlias = async (endpointId: string,
    recoveryDeviceAliasUpdate: RecoveryDeviceAliasUpdate, options?: Parameters<typeof customFetch>[1]): Promise<RecoveryDevice> => {

  return customFetch<RecoveryDevice>(getUpdateRecoveryDeviceAliasUrl(endpointId),
  {
    ...options,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(recoveryDeviceAliasUpdate)
  }
);}





export const getUpdateRecoveryDeviceAliasMutationOptions = <TError = ErrorType<ApiError | UnauthorizedResponse | Action1UnavailableResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateRecoveryDeviceAlias>>, TError,{endpointId: string;data: BodyType<RecoveryDeviceAliasUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateRecoveryDeviceAlias>>, TError,{endpointId: string;data: BodyType<RecoveryDeviceAliasUpdate>}, TContext> => {

const mutationKey = ['updateRecoveryDeviceAlias'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateRecoveryDeviceAlias>>, {endpointId: string;data: BodyType<RecoveryDeviceAliasUpdate>}> = (props) => {
          const {endpointId,data} = props ?? {};

          return  updateRecoveryDeviceAlias(endpointId,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UpdateRecoveryDeviceAliasMutationResult = NonNullable<Awaited<ReturnType<typeof updateRecoveryDeviceAlias>>>
    export type UpdateRecoveryDeviceAliasMutationBody = BodyType<RecoveryDeviceAliasUpdate>
    export type UpdateRecoveryDeviceAliasMutationError = ErrorType<ApiError | UnauthorizedResponse | Action1UnavailableResponse>

    /**
 * @summary Set or clear the friendly name for one recovery endpoint
 */
export const useUpdateRecoveryDeviceAlias = <TError = ErrorType<ApiError | UnauthorizedResponse | Action1UnavailableResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateRecoveryDeviceAlias>>, TError,{endpointId: string;data: BodyType<RecoveryDeviceAliasUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof updateRecoveryDeviceAlias>>,
        TError,
        {endpointId: string;data: BodyType<RecoveryDeviceAliasUpdate>},
        TContext
      > => {
      return useMutation(getUpdateRecoveryDeviceAliasMutationOptions(options));
    }

export const getGetRecoveryDeviceLocationHistoryUrl = (endpointId: string,
    params?: GetRecoveryDeviceLocationHistoryParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/recovery/devices/${endpointId}/location-history?${stringifiedParams}` : `/api/recovery/devices/${endpointId}/location-history`
}

/**
 * @summary Get time-bounded, last-known observations for one Action1 endpoint
 */
export const getRecoveryDeviceLocationHistory = async (endpointId: string,
    params?: GetRecoveryDeviceLocationHistoryParams, options?: Parameters<typeof customFetch>[1]): Promise<RecoveryLocationHistory> => {

  return customFetch<RecoveryLocationHistory>(getGetRecoveryDeviceLocationHistoryUrl(endpointId,params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetRecoveryDeviceLocationHistoryQueryKey = (endpointId: string,
    params?: GetRecoveryDeviceLocationHistoryParams,) => {
    return [
    `/api/recovery/devices/${endpointId}/location-history`, ...(params ? [params] : [])
    ] as const;
    }


export const getGetRecoveryDeviceLocationHistoryQueryOptions = <TData = Awaited<ReturnType<typeof getRecoveryDeviceLocationHistory>>, TError = ErrorType<ApiError | UnauthorizedResponse>>(endpointId: string,
    params?: GetRecoveryDeviceLocationHistoryParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getRecoveryDeviceLocationHistory>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetRecoveryDeviceLocationHistoryQueryKey(endpointId,params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getRecoveryDeviceLocationHistory>>> = ({ signal }) => getRecoveryDeviceLocationHistory(endpointId,params, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: endpointId !== null && endpointId !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getRecoveryDeviceLocationHistory>>, TError, TData> & { queryKey: QueryKey }
}

export type GetRecoveryDeviceLocationHistoryQueryResult = NonNullable<Awaited<ReturnType<typeof getRecoveryDeviceLocationHistory>>>
export type GetRecoveryDeviceLocationHistoryQueryError = ErrorType<ApiError | UnauthorizedResponse>


/**
 * @summary Get time-bounded, last-known observations for one Action1 endpoint
 */

export function useGetRecoveryDeviceLocationHistory<TData = Awaited<ReturnType<typeof getRecoveryDeviceLocationHistory>>, TError = ErrorType<ApiError | UnauthorizedResponse>>(
 endpointId: string,
    params?: GetRecoveryDeviceLocationHistoryParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getRecoveryDeviceLocationHistory>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetRecoveryDeviceLocationHistoryQueryOptions(endpointId,params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getExportRecoveryDeviceLocationHistoryUrl = (endpointId: string,
    params?: ExportRecoveryDeviceLocationHistoryParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/recovery/devices/${endpointId}/location-history/export?${stringifiedParams}` : `/api/recovery/devices/${endpointId}/location-history/export`
}

/**
 * @summary Export time-bounded, last-known observations for one Action1 endpoint
 */
export const exportRecoveryDeviceLocationHistory = async (endpointId: string,
    params?: ExportRecoveryDeviceLocationHistoryParams, options?: Parameters<typeof customFetch>[1]): Promise<RecoveryLocationHistoryExport | string> => {

  return customFetch<RecoveryLocationHistoryExport | string>(getExportRecoveryDeviceLocationHistoryUrl(endpointId,params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getExportRecoveryDeviceLocationHistoryQueryKey = (endpointId: string,
    params?: ExportRecoveryDeviceLocationHistoryParams,) => {
    return [
    `/api/recovery/devices/${endpointId}/location-history/export`, ...(params ? [params] : [])
    ] as const;
    }


export const getExportRecoveryDeviceLocationHistoryQueryOptions = <TData = Awaited<ReturnType<typeof exportRecoveryDeviceLocationHistory>>, TError = ErrorType<ApiError | UnauthorizedResponse | RateLimitedResponse>>(endpointId: string,
    params?: ExportRecoveryDeviceLocationHistoryParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof exportRecoveryDeviceLocationHistory>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getExportRecoveryDeviceLocationHistoryQueryKey(endpointId,params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof exportRecoveryDeviceLocationHistory>>> = ({ signal }) => exportRecoveryDeviceLocationHistory(endpointId,params, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: endpointId !== null && endpointId !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof exportRecoveryDeviceLocationHistory>>, TError, TData> & { queryKey: QueryKey }
}

export type ExportRecoveryDeviceLocationHistoryQueryResult = NonNullable<Awaited<ReturnType<typeof exportRecoveryDeviceLocationHistory>>>
export type ExportRecoveryDeviceLocationHistoryQueryError = ErrorType<ApiError | UnauthorizedResponse | RateLimitedResponse>


/**
 * @summary Export time-bounded, last-known observations for one Action1 endpoint
 */

export function useExportRecoveryDeviceLocationHistory<TData = Awaited<ReturnType<typeof exportRecoveryDeviceLocationHistory>>, TError = ErrorType<ApiError | UnauthorizedResponse | RateLimitedResponse>>(
 endpointId: string,
    params?: ExportRecoveryDeviceLocationHistoryParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof exportRecoveryDeviceLocationHistory>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getExportRecoveryDeviceLocationHistoryQueryOptions(endpointId,params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getListRecoveryLocationHistoryUrl = (params?: ListRecoveryLocationHistoryParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    const explodeParameters = ["endpointIds"];

    if (Array.isArray(value) && explodeParameters.includes(key)) {
      value.forEach((v) => {
        normalizedParams.append(key, v === null ? 'null' : String(v));
      });
      return;
    }

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/recovery/location-history?${stringifiedParams}` : `/api/recovery/location-history`
}

/**
 * @summary List persisted last-known observations for the fleet or selected Action1 endpoints
 */
export const listRecoveryLocationHistory = async (params?: ListRecoveryLocationHistoryParams, options?: Parameters<typeof customFetch>[1]): Promise<RecoveryLocationHistory> => {

  return customFetch<RecoveryLocationHistory>(getListRecoveryLocationHistoryUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getListRecoveryLocationHistoryQueryKey = (params?: ListRecoveryLocationHistoryParams,) => {
    return [
    `/api/recovery/location-history`, ...(params ? [params] : [])
    ] as const;
    }


export const getListRecoveryLocationHistoryQueryOptions = <TData = Awaited<ReturnType<typeof listRecoveryLocationHistory>>, TError = ErrorType<ApiError | UnauthorizedResponse>>(params?: ListRecoveryLocationHistoryParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listRecoveryLocationHistory>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getListRecoveryLocationHistoryQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof listRecoveryLocationHistory>>> = ({ signal }) => listRecoveryLocationHistory(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listRecoveryLocationHistory>>, TError, TData> & { queryKey: QueryKey }
}

export type ListRecoveryLocationHistoryQueryResult = NonNullable<Awaited<ReturnType<typeof listRecoveryLocationHistory>>>
export type ListRecoveryLocationHistoryQueryError = ErrorType<ApiError | UnauthorizedResponse>


/**
 * @summary List persisted last-known observations for the fleet or selected Action1 endpoints
 */

export function useListRecoveryLocationHistory<TData = Awaited<ReturnType<typeof listRecoveryLocationHistory>>, TError = ErrorType<ApiError | UnauthorizedResponse>>(
 params?: ListRecoveryLocationHistoryParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listRecoveryLocationHistory>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getListRecoveryLocationHistoryQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getExportRecoveryLocationHistoryUrl = (params?: ExportRecoveryLocationHistoryParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    const explodeParameters = ["endpointIds"];

    if (Array.isArray(value) && explodeParameters.includes(key)) {
      value.forEach((v) => {
        normalizedParams.append(key, v === null ? 'null' : String(v));
      });
      return;
    }

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/recovery/location-history/export?${stringifiedParams}` : `/api/recovery/location-history/export`
}

/**
 * @summary Export persisted last-known observations for the fleet or selected endpoints
 */
export const exportRecoveryLocationHistory = async (params?: ExportRecoveryLocationHistoryParams, options?: Parameters<typeof customFetch>[1]): Promise<RecoveryLocationHistoryExport | string> => {

  return customFetch<RecoveryLocationHistoryExport | string>(getExportRecoveryLocationHistoryUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getExportRecoveryLocationHistoryQueryKey = (params?: ExportRecoveryLocationHistoryParams,) => {
    return [
    `/api/recovery/location-history/export`, ...(params ? [params] : [])
    ] as const;
    }


export const getExportRecoveryLocationHistoryQueryOptions = <TData = Awaited<ReturnType<typeof exportRecoveryLocationHistory>>, TError = ErrorType<ApiError | UnauthorizedResponse | RateLimitedResponse>>(params?: ExportRecoveryLocationHistoryParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof exportRecoveryLocationHistory>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getExportRecoveryLocationHistoryQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof exportRecoveryLocationHistory>>> = ({ signal }) => exportRecoveryLocationHistory(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof exportRecoveryLocationHistory>>, TError, TData> & { queryKey: QueryKey }
}

export type ExportRecoveryLocationHistoryQueryResult = NonNullable<Awaited<ReturnType<typeof exportRecoveryLocationHistory>>>
export type ExportRecoveryLocationHistoryQueryError = ErrorType<ApiError | UnauthorizedResponse | RateLimitedResponse>


/**
 * @summary Export persisted last-known observations for the fleet or selected endpoints
 */

export function useExportRecoveryLocationHistory<TData = Awaited<ReturnType<typeof exportRecoveryLocationHistory>>, TError = ErrorType<ApiError | UnauthorizedResponse | RateLimitedResponse>>(
 params?: ExportRecoveryLocationHistoryParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof exportRecoveryLocationHistory>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getExportRecoveryLocationHistoryQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getListRecoveryIncidentsUrl = () => {




  return `/api/recovery/incidents`
}

/**
 * @summary List recovery incidents
 */
export const listRecoveryIncidents = async ( options?: Parameters<typeof customFetch>[1]): Promise<RecoveryIncidentList> => {

  return customFetch<RecoveryIncidentList>(getListRecoveryIncidentsUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getListRecoveryIncidentsQueryKey = () => {
    return [
    `/api/recovery/incidents`
    ] as const;
    }


export const getListRecoveryIncidentsQueryOptions = <TData = Awaited<ReturnType<typeof listRecoveryIncidents>>, TError = ErrorType<UnauthorizedResponse>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listRecoveryIncidents>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getListRecoveryIncidentsQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof listRecoveryIncidents>>> = ({ signal }) => listRecoveryIncidents({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listRecoveryIncidents>>, TError, TData> & { queryKey: QueryKey }
}

export type ListRecoveryIncidentsQueryResult = NonNullable<Awaited<ReturnType<typeof listRecoveryIncidents>>>
export type ListRecoveryIncidentsQueryError = ErrorType<UnauthorizedResponse>


/**
 * @summary List recovery incidents
 */

export function useListRecoveryIncidents<TData = Awaited<ReturnType<typeof listRecoveryIncidents>>, TError = ErrorType<UnauthorizedResponse>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listRecoveryIncidents>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getListRecoveryIncidentsQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getCreateRecoveryIncidentUrl = () => {




  return `/api/recovery/incidents`
}

/**
 * @summary Create an incident and capture current endpoint evidence
 */
export const createRecoveryIncident = async (recoveryIncidentInput: RecoveryIncidentInput, options?: Parameters<typeof customFetch>[1]): Promise<RecoveryIncidentDetail> => {

  return customFetch<RecoveryIncidentDetail>(getCreateRecoveryIncidentUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(recoveryIncidentInput)
  }
);}





export const getCreateRecoveryIncidentMutationOptions = <TError = ErrorType<ApiError | UnauthorizedResponse | Action1UnavailableResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createRecoveryIncident>>, TError,{data: BodyType<RecoveryIncidentInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createRecoveryIncident>>, TError,{data: BodyType<RecoveryIncidentInput>}, TContext> => {

const mutationKey = ['createRecoveryIncident'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createRecoveryIncident>>, {data: BodyType<RecoveryIncidentInput>}> = (props) => {
          const {data} = props ?? {};

          return  createRecoveryIncident(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreateRecoveryIncidentMutationResult = NonNullable<Awaited<ReturnType<typeof createRecoveryIncident>>>
    export type CreateRecoveryIncidentMutationBody = BodyType<RecoveryIncidentInput>
    export type CreateRecoveryIncidentMutationError = ErrorType<ApiError | UnauthorizedResponse | Action1UnavailableResponse>

    /**
 * @summary Create an incident and capture current endpoint evidence
 */
export const useCreateRecoveryIncident = <TError = ErrorType<ApiError | UnauthorizedResponse | Action1UnavailableResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createRecoveryIncident>>, TError,{data: BodyType<RecoveryIncidentInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createRecoveryIncident>>,
        TError,
        {data: BodyType<RecoveryIncidentInput>},
        TContext
      > => {
      return useMutation(getCreateRecoveryIncidentMutationOptions(options));
    }

export const getGetRecoveryIncidentUrl = (incidentId: string,) => {




  return `/api/recovery/incidents/${incidentId}`
}

/**
 * @summary Get an incident with captured endpoint evidence and audit records
 */
export const getRecoveryIncident = async (incidentId: string, options?: Parameters<typeof customFetch>[1]): Promise<RecoveryIncidentDetail> => {

  return customFetch<RecoveryIncidentDetail>(getGetRecoveryIncidentUrl(incidentId),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetRecoveryIncidentQueryKey = (incidentId: string,) => {
    return [
    `/api/recovery/incidents/${incidentId}`
    ] as const;
    }


export const getGetRecoveryIncidentQueryOptions = <TData = Awaited<ReturnType<typeof getRecoveryIncident>>, TError = ErrorType<UnauthorizedResponse | ApiError>>(incidentId: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getRecoveryIncident>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetRecoveryIncidentQueryKey(incidentId);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getRecoveryIncident>>> = ({ signal }) => getRecoveryIncident(incidentId, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: incidentId !== null && incidentId !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getRecoveryIncident>>, TError, TData> & { queryKey: QueryKey }
}

export type GetRecoveryIncidentQueryResult = NonNullable<Awaited<ReturnType<typeof getRecoveryIncident>>>
export type GetRecoveryIncidentQueryError = ErrorType<UnauthorizedResponse | ApiError>


/**
 * @summary Get an incident with captured endpoint evidence and audit records
 */

export function useGetRecoveryIncident<TData = Awaited<ReturnType<typeof getRecoveryIncident>>, TError = ErrorType<UnauthorizedResponse | ApiError>>(
 incidentId: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getRecoveryIncident>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetRecoveryIncidentQueryOptions(incidentId,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getUpdateRecoveryIncidentUrl = (incidentId: string,) => {




  return `/api/recovery/incidents/${incidentId}`
}

/**
 * @summary Update incident ownership, status, case information, or add a note
 */
export const updateRecoveryIncident = async (incidentId: string,
    recoveryIncidentUpdate: RecoveryIncidentUpdate, options?: Parameters<typeof customFetch>[1]): Promise<RecoveryIncidentDetail> => {

  return customFetch<RecoveryIncidentDetail>(getUpdateRecoveryIncidentUrl(incidentId),
  {
    ...options,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(recoveryIncidentUpdate)
  }
);}





export const getUpdateRecoveryIncidentMutationOptions = <TError = ErrorType<ApiError | UnauthorizedResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateRecoveryIncident>>, TError,{incidentId: string;data: BodyType<RecoveryIncidentUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateRecoveryIncident>>, TError,{incidentId: string;data: BodyType<RecoveryIncidentUpdate>}, TContext> => {

const mutationKey = ['updateRecoveryIncident'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateRecoveryIncident>>, {incidentId: string;data: BodyType<RecoveryIncidentUpdate>}> = (props) => {
          const {incidentId,data} = props ?? {};

          return  updateRecoveryIncident(incidentId,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UpdateRecoveryIncidentMutationResult = NonNullable<Awaited<ReturnType<typeof updateRecoveryIncident>>>
    export type UpdateRecoveryIncidentMutationBody = BodyType<RecoveryIncidentUpdate>
    export type UpdateRecoveryIncidentMutationError = ErrorType<ApiError | UnauthorizedResponse>

    /**
 * @summary Update incident ownership, status, case information, or add a note
 */
export const useUpdateRecoveryIncident = <TError = ErrorType<ApiError | UnauthorizedResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateRecoveryIncident>>, TError,{incidentId: string;data: BodyType<RecoveryIncidentUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof updateRecoveryIncident>>,
        TError,
        {incidentId: string;data: BodyType<RecoveryIncidentUpdate>},
        TContext
      > => {
      return useMutation(getUpdateRecoveryIncidentMutationOptions(options));
    }

export const getExportRecoveryIncidentUrl = (incidentId: string,) => {




  return `/api/recovery/incidents/${incidentId}/export`
}

/**
 * @summary Generate a controlled incident evidence export
 */
export const exportRecoveryIncident = async (incidentId: string,
    recoveryEvidenceExportRequest: RecoveryEvidenceExportRequest, options?: Parameters<typeof customFetch>[1]): Promise<RecoveryEvidenceExport | string> => {

  return customFetch<RecoveryEvidenceExport | string>(getExportRecoveryIncidentUrl(incidentId),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(recoveryEvidenceExportRequest)
  }
);}





export const getExportRecoveryIncidentMutationOptions = <TError = ErrorType<UnauthorizedResponse | ApiError | RateLimitedResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof exportRecoveryIncident>>, TError,{incidentId: string;data: BodyType<RecoveryEvidenceExportRequest>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof exportRecoveryIncident>>, TError,{incidentId: string;data: BodyType<RecoveryEvidenceExportRequest>}, TContext> => {

const mutationKey = ['exportRecoveryIncident'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof exportRecoveryIncident>>, {incidentId: string;data: BodyType<RecoveryEvidenceExportRequest>}> = (props) => {
          const {incidentId,data} = props ?? {};

          return  exportRecoveryIncident(incidentId,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type ExportRecoveryIncidentMutationResult = NonNullable<Awaited<ReturnType<typeof exportRecoveryIncident>>>
    export type ExportRecoveryIncidentMutationBody = BodyType<RecoveryEvidenceExportRequest>
    export type ExportRecoveryIncidentMutationError = ErrorType<UnauthorizedResponse | ApiError | RateLimitedResponse>

    /**
 * @summary Generate a controlled incident evidence export
 */
export const useExportRecoveryIncident = <TError = ErrorType<UnauthorizedResponse | ApiError | RateLimitedResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof exportRecoveryIncident>>, TError,{incidentId: string;data: BodyType<RecoveryEvidenceExportRequest>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof exportRecoveryIncident>>,
        TError,
        {incidentId: string;data: BodyType<RecoveryEvidenceExportRequest>},
        TContext
      > => {
      return useMutation(getExportRecoveryIncidentMutationOptions(options));
    }

