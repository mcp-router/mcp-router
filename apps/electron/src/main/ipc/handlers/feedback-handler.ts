import { ipcMain } from "electron";
import { API_BASE_URL } from "@/main";

export function setupFeedbackHandlers(): void {
  ipcMain.handle("feedback:submit", async (_, feedback: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ feedback }),
      });
      return response.ok;
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      return false;
    }
  });
}
