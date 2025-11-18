import AsyncStorage from "@react-native-async-storage/async-storage";

// Navigation utility for inter-screen communication
class NavigationService {
  private static instance: NavigationService;
  private navigationCallbacks: Map<string, () => void> = new Map();

  static getInstance(): NavigationService {
    if (!NavigationService.instance) {
      NavigationService.instance = new NavigationService();
    }
    return NavigationService.instance;
  }

  // Register a callback for navigation events
  registerCallback(event: string, callback: () => void) {
    this.navigationCallbacks.set(event, callback);
  }

  // Trigger a navigation event
  async navigateToTab(tab: string, data?: any) {
    // Store navigation data
    if (data) {
      await AsyncStorage.setItem("navigation_data", JSON.stringify(data));
    }
    await AsyncStorage.setItem("navigation_event", tab);

    // Trigger callback if registered
    const callback = this.navigationCallbacks.get(tab);
    if (callback) {
      callback();
    }
  }

  // Check for pending navigation on app start
  async checkPendingNavigation(): Promise<{
    event: string | null;
    data: any | null;
  }> {
    try {
      const event = await AsyncStorage.getItem("navigation_event");
      const dataStr = await AsyncStorage.getItem("navigation_data");

      // Clear the stored navigation
      await AsyncStorage.removeItem("navigation_event");
      await AsyncStorage.removeItem("navigation_data");

      const data = dataStr ? JSON.parse(dataStr) : null;

      return { event, data };
    } catch (error) {
      console.error("Error checking pending navigation:", error);
      return { event: null, data: null };
    }
  }
}

export default NavigationService;
