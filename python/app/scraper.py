from playwright.sync_api import sync_playwright
from urllib.parse import quote_plus
import time
import sys
import os
from pathlib import Path


def scrape_naukri(keywords: str, location: str, email: str, password: str, headless: bool = True):
    """
    Logs into Naukri Recruiter account and scrapes candidate cards from Resdex.
    Uses form-based search as Resdex requires authentication.
    """

    print(f"Starting scraper with headless={headless}")
    print(f"Keywords: {keywords}, Location: {location}")
    sys.stdout.flush()

    playwright = sync_playwright().start()

    try:
        print("Launching browser...")
        sys.stdout.flush()

        browser = playwright.chromium.launch(
            headless=headless,
            slow_mo=100,
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )

        print("Browser launched successfully")
        sys.stdout.flush()

        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = context.new_page()

        # Step 1: Login to Naukri Recruiter
        print("Step 1: Navigating to Naukri Recruiter login page...")
        sys.stdout.flush()

        page.goto("https://www.naukri.com/recruit/login", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(3000)

        print(f"Current URL: {page.url}")
        page.screenshot(path="step1_login_page.png")
        sys.stdout.flush()

        # Fill login form
        print("Filling login credentials...")
        sys.stdout.flush()

        # Try to find and fill email/username field
        email_selectors = [
            "input[name='username']",
            "input[name='email']",
            "input[type='email']",
            "#username",
            "#email",
            "input[placeholder*='email' i]",
            "input[placeholder*='username' i]",
        ]

        email_filled = False
        for selector in email_selectors:
            try:
                if page.locator(selector).count() > 0:
                    page.fill(selector, email)
                    print(f"Filled email using selector: {selector}")
                    email_filled = True
                    break
            except:
                continue

        if not email_filled:
            page.screenshot(path="login_form_not_found.png")
            raise Exception("Could not find email input field")

        # Fill password
        password_selectors = [
            "input[name='password']",
            "input[type='password']",
            "#password",
        ]

        for selector in password_selectors:
            try:
                if page.locator(selector).count() > 0:
                    page.fill(selector, password)
                    print(f"Filled password using selector: {selector}")
                    break
            except:
                continue

        page.screenshot(path="step2_credentials_filled.png")

        # Click login button
        print("Clicking login button...")
        login_selectors = [
            "button[type='submit']",
            "input[type='submit']",
            "button:has-text('Login')",
            "button:has-text('Sign in')",
            ".login-btn",
            "#loginButton",
        ]

        for selector in login_selectors:
            try:
                if page.locator(selector).count() > 0:
                    page.click(selector)
                    print(f"Clicked login using selector: {selector}")
                    break
            except:
                continue

        # Wait for login to complete
        print("Waiting for login to complete...")
        page.wait_for_timeout(5000)
        page.screenshot(path="step3_after_login.png")
        print(f"URL after login: {page.url}")

        # Check for OTP requirement (Naukri requires OTP)
        if page.locator("input[name='otp']").count() > 0 or "otp" in page.url.lower():
            print("OTP verification required! Please check your email and enter OTP in the browser.")
            page.screenshot(path="otp_required.png")
            # Wait for manual OTP entry (in non-headless mode)
            if not headless:
                print("Waiting 60 seconds for manual OTP entry...")
                page.wait_for_timeout(60000)
            else:
                raise Exception("OTP verification required. Run with HEADLESS=false to enter OTP manually.")

        # Step 2: Navigate to Resdex
        print("Step 2: Navigating to Resdex...")

        resdex_urls = [
            "https://resdex.naukri.com/v2/search",
            "https://www.naukri.com/recruit/resdex",
            "https://resdex.naukri.com/search",
        ]

        resdex_loaded = False
        for resdex_url in resdex_urls:
            try:
                print(f"Trying Resdex URL: {resdex_url}")
                page.goto(resdex_url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                # Check if redirected to login
                if "login" in page.url.lower():
                    print("Redirected to login, trying next URL...")
                    continue

                page.screenshot(path="step4_resdex_page.png")
                print(f"Resdex URL loaded: {page.url}")
                resdex_loaded = True
                break
            except Exception as e:
                print(f"Failed to load {resdex_url}: {e}")
                continue

        if not resdex_loaded:
            # Try clicking Resdex link from dashboard
            print("Trying to find Resdex link on dashboard...")
            resdex_links = [
                "a:has-text('Resdex')",
                "a:has-text('Search Resumes')",
                "a[href*='resdex']",
            ]
            for link_selector in resdex_links:
                try:
                    if page.locator(link_selector).count() > 0:
                        page.click(link_selector)
                        page.wait_for_timeout(3000)
                        print(f"Clicked Resdex link: {link_selector}")
                        resdex_loaded = True
                        break
                except:
                    continue

        page.screenshot(path="step5_resdex_loaded.png")
        print(f"Current URL: {page.url}")

        # Step 3: Fill search form
        print("Step 3: Filling search form...")

        # Try to fill keywords
        keyword_selectors = [
            "input[name='keywords']",
            "input[placeholder*='keyword' i]",
            "input[placeholder*='skill' i]",
            "#keywords",
            ".keyword-input",
            "input[name='qp']",
        ]

        for selector in keyword_selectors:
            try:
                if page.locator(selector).count() > 0:
                    page.fill(selector, keywords)
                    print(f"Filled keywords using: {selector}")
                    break
            except:
                continue

        # Try to fill location
        location_selectors = [
            "input[name='location']",
            "input[placeholder*='location' i]",
            "input[placeholder*='city' i]",
            "#location",
            ".location-input",
            "input[name='ql']",
        ]

        for selector in location_selectors:
            try:
                if page.locator(selector).count() > 0:
                    page.fill(selector, location)
                    print(f"Filled location using: {selector}")
                    break
            except:
                continue

        page.screenshot(path="step6_search_filled.png")

        # Click search button
        print("Clicking search button...")
        search_selectors = [
            "button[type='submit']",
            "button:has-text('Search')",
            "input[type='submit']",
            ".search-btn",
            "#searchButton",
        ]

        for selector in search_selectors:
            try:
                if page.locator(selector).count() > 0:
                    page.click(selector)
                    print(f"Clicked search using: {selector}")
                    break
            except:
                continue

        # Wait for results
        print("Waiting for search results...")
        page.wait_for_timeout(5000)
        page.screenshot(path="step7_search_results.png")
        print(f"Results URL: {page.url}")

        # Step 4: Extract candidates
        print("Step 4: Extracting candidate data...")

        # Try different card selectors
        card_selectors = [
            ".tuple-card",
            ".candidate-card",
            ".search-result-card",
            "[data-candidateid]",
            ".srp-tuple",
            ".cand-tuple",
            ".resume-card",
            ".profile-card",
            "article",
            ".result-item",
        ]

        candidates = []

        for selector in card_selectors:
            try:
                count = page.locator(selector).count()
                if count > 0:
                    print(f"Found {count} elements with selector: {selector}")

                    candidates = page.evaluate(
                        f"""() => {{
                            const cards = document.querySelectorAll('{selector}');
                            return Array.from(cards).slice(0, 20).map((card, index) => {{
                                const getText = (selectors) => {{
                                    for (const s of selectors) {{
                                        const el = card.querySelector(s);
                                        if (el && el.innerText && el.innerText.trim()) {{
                                            return el.innerText.trim();
                                        }}
                                    }}
                                    return '';
                                }};

                                return {{
                                    name: getText(['.name', '.cand-name', '.candidate-name', 'h3', 'h2', '.title', '[class*="name"]']) || 'Candidate ' + (index + 1),
                                    title: getText(['.desig', '.designation', '.current-designation', '.job-title', '[class*="desig"]']),
                                    experience: getText(['.exp', '.experience', '[class*="exp"]']),
                                    location: getText(['.loc', '.location', '.city', '[class*="loc"]']),
                                    company: getText(['.company', '.org', '.employer', '[class*="company"]']),
                                    skills: getText(['.skills', '.key-skills', '.skill-list', '[class*="skill"]']),
                                }};
                            }});
                        }}"""
                    )

                    if candidates and len(candidates) > 0:
                        candidates = [c for c in candidates if c.get('name') and c['name'] != '']
                        if candidates:
                            print(f"Successfully extracted {len(candidates)} candidates")
                            break
            except Exception as e:
                print(f"Selector {selector} failed: {e}")
                continue

        if not candidates or len(candidates) == 0:
            print("No candidates found with card selectors")
            page.screenshot(path="no_candidates_found.png")

        browser.close()
        playwright.stop()
        return candidates

    except Exception as e:
        print(f"Scraping error: {e}")
        sys.stdout.flush()
        try:
            playwright.stop()
        except:
            pass
        raise e


def search_and_download_resumes(keywords: str, location: str, email: str, password: str, headless: bool = True, max_resumes: int = 20):
    """
    Search for candidates on Naukri Resdex and download their resumes.
    Returns list of downloaded file paths and candidate details.
    """
    print(f"Starting resume download with headless={headless}")
    print(f"Keywords: {keywords}, Location: {location}, Max resumes: {max_resumes}")
    sys.stdout.flush()

    # Create downloads directory
    downloads_dir = Path(__file__).parent.parent / "downloads"
    downloads_dir.mkdir(exist_ok=True)
    print(f"Downloads directory: {downloads_dir}")

    playwright = sync_playwright().start()
    downloaded_files = []
    candidates = []

    try:
        print("Launching browser...")
        sys.stdout.flush()

        # Use more stable browser configuration
        browser = playwright.chromium.launch(
            headless=headless,
            args=[
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
            ]
        )

        context = browser.new_context(
            viewport={'width': 1366, 'height': 768},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            accept_downloads=True,
            java_script_enabled=True,
        )

        # Remove webdriver flag to avoid bot detection
        page = context.new_page()
        page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        """)

        # ===== STEP 1: Login to Naukri Recruiter =====
        print("Step 1: Logging into Naukri Recruiter...")
        sys.stdout.flush()

        # Go to Naukri homepage first, then navigate to login
        print("Going to Naukri homepage first...")
        page.goto("https://www.naukri.com", timeout=60000)
        page.wait_for_load_state("domcontentloaded")
        time.sleep(3)

        page.screenshot(path=str(downloads_dir / "step0_homepage.png"))
        print(f"Homepage URL: {page.url}")

        # Now go to login page
        login_url = "https://www.naukri.com/nlogin/login"
        print(f"Navigating to login: {login_url}")
        page.goto(login_url, timeout=60000)
        page.wait_for_load_state("domcontentloaded")
        time.sleep(5)  # Use time.sleep instead of page.wait_for_timeout

        page.screenshot(path=str(downloads_dir / "step1_login_page.png"))
        print(f"Login page URL: {page.url}")

        # Wait for email input to be visible
        print("Looking for email input field...")
        email_input = None
        email_selectors = [
            "input[id='usernameField']",
            "input[placeholder*='Enter your active Email' i]",
            "input[placeholder*='email' i]",
            "input[type='email']",
        ]

        for selector in email_selectors:
            try:
                el = page.locator(selector).first
                if el.count() > 0 and el.is_visible():
                    email_input = el
                    print(f"Found email input: {selector}")
                    break
            except:
                continue

        if not email_input:
            page.screenshot(path=str(downloads_dir / "error_no_email_field.png"))
            raise Exception("Could not find email input field. Check step1_login_page.png and error_no_email_field.png")

        # Fill email using keyboard
        print(f"Filling email: {email}")
        email_input.click()
        time.sleep(0.5)
        page.keyboard.type(email, delay=100)
        time.sleep(1)

        # Look for password field
        print("Looking for password input field...")
        password_input = None
        password_selectors = [
            "input[id='passwordField']",
            "input[type='password']",
            "input[placeholder*='password' i]",
        ]

        for selector in password_selectors:
            try:
                el = page.locator(selector).first
                if el.count() > 0 and el.is_visible():
                    password_input = el
                    print(f"Found password input: {selector}")
                    break
            except:
                continue

        if not password_input:
            page.screenshot(path=str(downloads_dir / "error_no_password_field.png"))
            raise Exception("Could not find password input field. Check error_no_password_field.png")

        # Fill password using keyboard
        print("Filling password...")
        password_input.click()
        time.sleep(0.5)
        page.keyboard.type(password, delay=100)
        time.sleep(1)

        page.screenshot(path=str(downloads_dir / "step2_credentials_filled.png"))

        # Click login button
        print("Looking for login button...")
        login_btn_selectors = [
            "button:has-text('Login')",
            "button[type='submit']",
            "input[type='submit']",
        ]

        login_clicked = False
        for selector in login_btn_selectors:
            try:
                btn = page.locator(selector).first
                if btn.count() > 0 and btn.is_visible():
                    print(f"Clicking login button: {selector}")
                    btn.click()
                    login_clicked = True
                    break
            except:
                continue

        if not login_clicked:
            # Try pressing Enter as fallback
            print("Trying Enter key to submit...")
            page.keyboard.press("Enter")

        # Wait for login to complete
        print("Waiting for login to complete...")
        time.sleep(8)
        page.screenshot(path=str(downloads_dir / "step3_after_login.png"))
        print(f"URL after login: {page.url}")

        # Check for OTP
        if page.locator("input[name='otp']").count() > 0 or "otp" in page.url.lower():
            print("OTP verification required!")
            page.screenshot(path=str(downloads_dir / "otp_required.png"))
            if not headless:
                print("Waiting 60 seconds for manual OTP entry...")
                page.wait_for_timeout(60000)
            else:
                raise Exception("OTP verification required. Run with HEADLESS=false to enter OTP manually.")

        # ===== STEP 2: Navigate to Resdex =====
        print("Step 2: Navigating to Resdex...")
        resdex_urls = [
            "https://resdex.naukri.com/v2/search",
            "https://www.naukri.com/recruit/resdex",
            "https://resdex.naukri.com/search",
        ]

        for resdex_url in resdex_urls:
            try:
                page.goto(resdex_url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)
                if "login" not in page.url.lower():
                    print(f"Resdex loaded: {page.url}")
                    break
            except:
                continue

        # ===== STEP 3: Search for candidates =====
        print("Step 3: Searching for candidates...")

        keyword_selectors = [
            "input[name='keywords']",
            "input[placeholder*='keyword' i]",
            "input[placeholder*='skill' i]",
            "#keywords",
            ".keyword-input",
            "input[name='qp']",
        ]
        for selector in keyword_selectors:
            try:
                if page.locator(selector).count() > 0:
                    page.fill(selector, keywords)
                    print(f"Filled keywords using: {selector}")
                    break
            except:
                continue

        location_selectors = [
            "input[name='location']",
            "input[placeholder*='location' i]",
            "input[placeholder*='city' i]",
            "#location",
            ".location-input",
            "input[name='ql']",
        ]
        for selector in location_selectors:
            try:
                if page.locator(selector).count() > 0:
                    page.fill(selector, location)
                    print(f"Filled location using: {selector}")
                    break
            except:
                continue

        # Click search
        search_selectors = [
            "button[type='submit']",
            "button:has-text('Search')",
            "input[type='submit']",
            ".search-btn",
            "#searchButton",
        ]
        for selector in search_selectors:
            try:
                if page.locator(selector).count() > 0:
                    page.click(selector)
                    print(f"Clicked search using: {selector}")
                    break
            except:
                continue

        page.wait_for_timeout(5000)
        page.screenshot(path=str(downloads_dir / "search_results.png"))
        print(f"Search results URL: {page.url}")

        # ===== STEP 4: Find candidate cards and download resumes =====
        print("Step 4: Finding candidate cards...")

        card_selectors = [
            ".tuple-card",
            ".candidate-card",
            ".search-result-card",
            "[data-candidateid]",
            ".srp-tuple",
            ".cand-tuple",
            ".resume-card",
            ".profile-card",
            "article",
            ".result-item",
        ]

        candidate_cards = []
        for selector in card_selectors:
            count = page.locator(selector).count()
            if count > 0:
                print(f"Found {count} cards with selector: {selector}")
                candidate_cards = page.locator(selector).all()[:max_resumes]
                break

        if not candidate_cards:
            print("No candidate cards found")
            page.screenshot(path=str(downloads_dir / "no_candidates.png"))
            browser.close()
            playwright.stop()
            return {"downloaded_files": [], "candidates": [], "errors": ["No candidates found"]}

        print(f"Processing {len(candidate_cards)} candidates...")

        # Download selectors to try
        download_selectors = [
            "button:has-text('Download')",
            "button:has-text('Download Resume')",
            "a:has-text('Download')",
            "a[href*='download']",
            ".download-resume",
            ".download-btn",
            "[class*='download']",
            "button[title*='Download']",
            "[data-action='download']",
        ]

        errors = []

        for idx, card in enumerate(candidate_cards):
            try:
                print(f"\n--- Processing candidate {idx + 1}/{len(candidate_cards)} ---")

                # Extract candidate info before clicking
                candidate_info = {
                    "index": idx + 1,
                    "name": "",
                    "title": "",
                    "experience": "",
                    "location": "",
                }

                try:
                    name_el = card.locator(".name, .cand-name, .candidate-name, h3, h2").first
                    if name_el.count() > 0:
                        candidate_info["name"] = name_el.inner_text().strip()
                except:
                    pass

                try:
                    title_el = card.locator(".desig, .designation, .job-title").first
                    if title_el.count() > 0:
                        candidate_info["title"] = title_el.inner_text().strip()
                except:
                    pass

                print(f"Candidate: {candidate_info.get('name', 'Unknown')}")

                # Try to find download button directly on card
                download_clicked = False
                for dl_selector in download_selectors:
                    try:
                        dl_btn = card.locator(dl_selector).first
                        if dl_btn.count() > 0:
                            # Set up download handler
                            with page.expect_download(timeout=30000) as download_info:
                                dl_btn.click()

                            download = download_info.value
                            safe_name = (candidate_info.get("name") or f"candidate_{idx+1}").replace(" ", "_").replace("/", "_")[:50]
                            filename = f"{idx+1}_{safe_name}_{download.suggested_filename}"
                            filepath = downloads_dir / filename
                            download.save_as(str(filepath))

                            print(f"Downloaded: {filename}")
                            downloaded_files.append(str(filepath))
                            candidate_info["resume_file"] = str(filepath)
                            download_clicked = True
                            break
                    except Exception as e:
                        continue

                # If no direct download, try clicking card to open profile
                if not download_clicked:
                    try:
                        print("Trying to open candidate profile...")
                        card.click()
                        page.wait_for_timeout(3000)

                        # Look for download button in profile/modal
                        for dl_selector in download_selectors:
                            try:
                                dl_btn = page.locator(dl_selector).first
                                if dl_btn.count() > 0 and dl_btn.is_visible():
                                    with page.expect_download(timeout=30000) as download_info:
                                        dl_btn.click()

                                    download = download_info.value
                                    safe_name = (candidate_info.get("name") or f"candidate_{idx+1}").replace(" ", "_").replace("/", "_")[:50]
                                    filename = f"{idx+1}_{safe_name}_{download.suggested_filename}"
                                    filepath = downloads_dir / filename
                                    download.save_as(str(filepath))

                                    print(f"Downloaded: {filename}")
                                    downloaded_files.append(str(filepath))
                                    candidate_info["resume_file"] = str(filepath)
                                    download_clicked = True
                                    break
                            except:
                                continue

                        # Go back to search results
                        page.go_back()
                        page.wait_for_timeout(2000)

                    except Exception as e:
                        print(f"Error opening profile: {e}")
                        errors.append(f"Candidate {idx+1}: {str(e)}")

                if not download_clicked:
                    print(f"Could not download resume for candidate {idx+1}")
                    errors.append(f"Candidate {idx+1}: Download button not found")

                candidates.append(candidate_info)

            except Exception as e:
                print(f"Error processing candidate {idx+1}: {e}")
                errors.append(f"Candidate {idx+1}: {str(e)}")
                continue

        print(f"\n===== Download Complete =====")
        print(f"Downloaded {len(downloaded_files)} resumes")
        print(f"Errors: {len(errors)}")

        browser.close()
        playwright.stop()

        return {
            "downloaded_files": downloaded_files,
            "candidates": candidates,
            "errors": errors if errors else None
        }

    except Exception as e:
        print(f"Error: {e}")
        sys.stdout.flush()
        try:
            playwright.stop()
        except:
            pass
        raise e
