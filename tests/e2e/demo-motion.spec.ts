import { expect, test } from '@playwright/test';

test('the Motion demo runs its figure-eight loop without user input', async ({ page }) => {
  await page.goto('/demo/');

  const motionBox = page.locator('#motion-box');
  await expect(motionBox).toBeVisible();
  await expect(page.locator('.demo-card:has(#motion-box) .demo-label p'))
    .toHaveText('Figure-eight spring loop');

  const firstTransform = await motionBox.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await page.waitForTimeout(650);
  const secondTransform = await motionBox.evaluate(
    (element) => getComputedStyle(element).transform,
  );

  expect(secondTransform).not.toBe(firstTransform);
});
