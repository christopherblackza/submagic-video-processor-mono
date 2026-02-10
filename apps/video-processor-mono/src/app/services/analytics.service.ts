import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  
  constructor() { }

  logEvent(eventName: string, params: Record<string, any> = {}): void {
    console.log(`[Analytics] Event: ${eventName}`, params);
    // Integration with real analytics provider would go here
    // e.g. gtag('event', eventName, params);
  }

  logError(errorName: string, errorDetails: any): void {
    console.error(`[Analytics] Error: ${errorName}`, errorDetails);
    // Integration with error tracking service
  }

  trackPageView(pageName: string): void {
    console.log(`[Analytics] Page View: ${pageName}`);
  }
}
