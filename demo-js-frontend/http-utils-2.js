/**
 * @author amchavan, 22-Dec-2020
 * Adapted from https://blog.bearer.sh/add-retry-to-api-calls-javascript-node
 * (original version does not work; added proper timoeout from
 * https://stackoverflow.com/questions/33289726/combination-of-async-function-await-settimeout/33292942)
 */

class HttpError extends Error {
    constructor( message ) {
        super( message )
        this.message = message
    }
}

/**
 * retries:       Number of retries, defaults to zero (fails after first error)
 * backoff:       How long to wait before the next retry, in milliseconds; defaults to 200
 * backoffFactor: How much the backoff increases between retries, should be 1 or greater; default is 1 (no increase)
 * callback:      A function to be called before each retry. It will be given two args: number of remaining retries
 *                (1 or greater) and backoff duration
 */
const DEFAULT_RETRY_OPTIONS = {
    retries: 0,
    backoff: 200,
    backoffFactor: 1,
    callback: undefined
}

/**
 * Use as: await timeout( 200 )
 * @return A promise that resolves after ms milliseconds
 */
function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* This function and fetchWithRetry() are mutually recursive */
async function fetchWithRetryInternal(url, fetchOptions, response, retryOptions ) {

    if( response instanceof HttpError ) {
        // Recognize end of recursion
        throw response;
    }

    if( response.ok ) {
        return response.json()
    }
    else {
        if (retryOptions.retries > 0) {
            if( retryOptions.callback ) {
                retryOptions.callback( retryOptions.retries, retryOptions.backoff )
            }
            await timeout( retryOptions.backoff );
            const newRetryOptions = Object.assign( {}, retryOptions )
            newRetryOptions.retries = retryOptions.retries - 1
            newRetryOptions.backoff = Math.round( retryOptions.backoff * retryOptions.backoffFactor );
            return fetchWithRetry( url, fetchOptions, newRetryOptions )
        }
        else {
            // Signal end of recursion
            throw new HttpError( response.message ? response.message : response.status );
        }
    }
}

/**
 * Fetch some resource, retry in case of error
 *
 * @param url       URL of the resource
 * @param fetchOptions Options for fetch, see https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch,
 *                     may be undefined, in which case defaults to a simple GET
 * @param retryOptions Options for retry, see DEFAULT_RETRY_OPTIONS
 *
 * @return A Promise
 */
function fetchWithRetry( url, fetchOptions, retryOptions ) {

    // Compute final set of retry options combining the defaults with what was passed in
    retryOptions = retryOptions ? retryOptions : {}
    const finalRetryOptions = Object.assign( {}, DEFAULT_RETRY_OPTIONS, retryOptions )

    return fetch( url, fetchOptions )
        .then( response => fetchWithRetryInternal( url, fetchOptions, response, finalRetryOptions ))
        .catch( reason  => fetchWithRetryInternal( url, fetchOptions, reason,   finalRetryOptions ))
}