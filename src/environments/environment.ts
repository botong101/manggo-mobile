import { Environment } from './environment.interface';

export const environment: Environment = {
  production: false,
  // apiUrl: 'https://mango-deployment-production.up.railway.app/api'  // Changed to localhost for debugging
  apiUrl: 'http://127.0.0.1:8000/api' // Use this when server is on network
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
