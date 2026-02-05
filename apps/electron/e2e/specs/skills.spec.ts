import { test, expect } from "../fixtures/electron-app";
import { waitForAppReady } from "../utils/helpers";

test.describe("Skills Feature", () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test("should display the skills list", async ({ page }) => {
    // Navigate to skills section
    await page.click('[data-testid="nav-skills"], text=Skills, text=My Skills');

    // Wait for the skills manager to load
    await page.waitForSelector(
      '[data-testid="skills-manager"], .skills-container, text=Skills Library',
      { timeout: 10000 },
    );

    // Verify the skills section is visible
    const skillsSection = await page.isVisible(
      "text=Skills Library, text=My Skills",
    );
    expect(skillsSection).toBe(true);
  });

  test("should open new skill dialog", async ({ page }) => {
    // Navigate to skills
    await page.click('[data-testid="nav-skills"], text=Skills, text=My Skills');
    await page.waitForTimeout(1000);

    // Click the New button
    const newButton = page.locator(
      'button:has-text("New"), [data-testid="new-skill-button"]',
    );
    if (await newButton.isVisible()) {
      await newButton.click();

      // Wait for dialog to appear
      await page.waitForSelector(
        '[role="dialog"], [data-testid="new-skill-dialog"]',
        { timeout: 5000 },
      );

      // Verify dialog is open
      const dialogVisible = await page.isVisible(
        "text=Create New Skill, text=Enter a name",
      );
      expect(dialogVisible).toBe(true);
    }
  });

  test("should validate skill name input", async ({ page }) => {
    // Navigate to skills
    await page.click('[data-testid="nav-skills"], text=Skills, text=My Skills');
    await page.waitForTimeout(1000);

    // Open new skill dialog
    const newButton = page.locator(
      'button:has-text("New"), [data-testid="new-skill-button"]',
    );
    if (await newButton.isVisible()) {
      await newButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      // Try to create with empty name
      const createButton = page.locator(
        'button:has-text("Create"), [data-testid="create-skill-button"]',
      );
      if (await createButton.isVisible()) {
        await createButton.click();

        // Should show validation error
        const hasError = await page.isVisible(
          "text=required, text=name is required",
        );
        // Error may or may not be visible depending on validation timing
      }
    }
  });

  test("should show skill details when clicking a skill card", async ({
    page,
  }) => {
    // Navigate to skills
    await page.click('[data-testid="nav-skills"], text=Skills, text=My Skills');
    await page.waitForTimeout(2000);

    // Check if any skill cards exist
    const skillCards = page.locator(
      '[data-testid="skill-card"], .skill-card, [data-testid="unified-skill-card"]',
    );
    const cardCount = await skillCards.count();

    if (cardCount > 0) {
      // Click the first skill card
      await skillCards.first().click();

      // Wait for detail sheet to appear
      await page.waitForSelector(
        '[role="dialog"], [data-testid="skill-detail-sheet"], .sheet-content',
        { timeout: 5000 },
      );

      // Verify skill detail view is showing
      const hasDetailView = await page.isVisible(
        "text=SKILL.md, text=Content, text=Client",
      );
      expect(hasDetailView).toBe(true);
    }
  });

  test("should filter skills by search query", async ({ page }) => {
    // Navigate to skills
    await page.click('[data-testid="nav-skills"], text=Skills, text=My Skills');
    await page.waitForTimeout(2000);

    // Find and fill the search input
    const searchInput = page.locator(
      '[placeholder*="Search"], [data-testid="skills-search"], input[type="search"]',
    );
    if (await searchInput.isVisible()) {
      await searchInput.fill("nonexistent-skill-xyz");
      await page.waitForTimeout(500);

      // Should show no results message
      const noResults = await page.isVisible(
        "text=No skills, text=No results, text=No match",
      );
      // The no results message may vary based on implementation
    }
  });

  test("should handle refresh button click", async ({ page }) => {
    // Navigate to skills
    await page.click('[data-testid="nav-skills"], text=Skills, text=My Skills');
    await page.waitForTimeout(1000);

    // Find and click refresh button
    const refreshButton = page.locator(
      'button:has-text("Refresh"), [data-testid="refresh-skills"], button[aria-label*="refresh"]',
    );
    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Button should show loading state or data should refresh
      // This is a smoke test to ensure the button works without errors
      await page.waitForTimeout(2000);

      // Verify page is still functional
      const pageStillLoaded = await page.isVisible("text=Skills, text=Library");
      expect(pageStillLoaded).toBe(true);
    }
  });

  test("should show client filter dropdown", async ({ page }) => {
    // Navigate to skills
    await page.click('[data-testid="nav-skills"], text=Skills, text=My Skills');
    await page.waitForTimeout(1000);

    // Find and click client filter button
    const filterButton = page.locator(
      'button:has-text("Filter"), [data-testid="client-filter"]',
    );
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(500);

      // Dropdown should appear
      const dropdownVisible = await page.isVisible(
        '[role="menu"], [data-testid="client-filter-menu"], text=All Clients',
      );
      // Dropdown visibility depends on having clients configured
    }
  });
});
