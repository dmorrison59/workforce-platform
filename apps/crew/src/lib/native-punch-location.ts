import * as Location from "expo-location";
import { capturePunchLocation, PunchLocationError } from "./punch-location";

export async function readPunchLocation() {
  try {
    return await capturePunchLocation({
      getPermission: Location.getForegroundPermissionsAsync,
      requestPermission: Location.requestForegroundPermissionsAsync,
      servicesEnabled: Location.hasServicesEnabledAsync,
      currentPosition: () => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    });
  } catch (error) {
    throw error instanceof PunchLocationError ? error : new PunchLocationError("failed");
  }
}
