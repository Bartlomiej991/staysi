# STAYSI: uruchomienie krok po kroku

Potrzebujesz kont: GitHub, Supabase, Anthropic Console i Vercel, oraz programu GitHub Desktop.

## 1. Kod na GitHubie (GitHub Desktop)

1. Rozpakuj paczkę `staysi.zip` do folderu, np. `Dokumenty\staysi`. W środku muszą być od razu foldery `api`, `public`, `supabase` itd.
2. W GitHub Desktop: **File → Add local repository** → wskaż folder `staysi`.
3. Program powie, że to jeszcze nie repozytorium. Kliknij **create a repository**, nazwa: `staysi`, i potwierdź **Create repository**.
4. Po lewej zobaczysz listę plików. Na dole wpisz opis zmian, np. `Pierwsza wersja STAYSI`, i kliknij **Commit to main**.
5. Kliknij **Publish repository**. **Odznacz** „Keep this code private” (portfolio ma być publiczne) i kliknij **Publish repository**.
6. Na github.com sprawdź, że **nie ma** pliku `.env` (ma być tylko `.env.example`).

## 2. Baza danych (Supabase)

1. W projekcie `staysi` otwórz **SQL Editor → New query**.
2. Wklej całą zawartość pliku `supabase/schema.sql` i kliknij **Run**. Powinien pojawić się komunikat o sukcesie.
3. **Authentication → Sign In / Providers**: upewnij się, że **Email** jest włączony.
4. Klucze znajdziesz w **Project Settings → API Keys** (oraz adres projektu w **Data API** albo na stronie głównej projektu):
   - **Project URL** (np. `https://abcd.supabase.co`),
   - klucz **anon** albo **publishable** (publiczny),
   - klucz **service_role** albo **secret** (TAJNY, tylko do Vercel).

## 3. Klucz Claude (Anthropic Console)

1. **API Keys → Create Key**, nazwa: `staysi`.
2. Klucz pokazuje się tylko raz. Skopiuj go i od razu wklej w Vercel (krok 4). Nigdzie indziej go nie zapisuj ani nie wysyłaj.

## 4. Publikacja (Vercel)

1. **Add New → Project** → wybierz repozytorium `staysi`. Jeśli go nie widzisz, kliknij **Adjust GitHub App Permissions** i dodaj dostęp do `staysi`.
2. **Framework Preset:** Other. Pozostałe ustawienia budowania zostaw puste.
3. Rozwiń **Environment Variables** i dodaj:

| Nazwa | Wartość |
| --- | --- |
| `ANTHROPIC_API_KEY` | klucz z Anthropic Console |
| `SUPABASE_URL` | Project URL z Supabase |
| `SUPABASE_ANON_KEY` | klucz anon / publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | klucz service_role / secret |
| `MONTHLY_CAP_USD` | `5` |

4. Kliknij **Deploy**. Po minucie dostaniesz adres, np. `https://staysi-bartek991.vercel.app`.

## 5. Logowanie: adres aplikacji w Supabase

1. Supabase → **Authentication → URL Configuration**.
2. **Site URL**: wpisz adres z Vercel.
3. **Redirect URLs**: dodaj ten sam adres. Zapisz.

Dzięki temu link potwierdzający e-mail przeniesie cię z powrotem do STAYSI.

## 6. Ikona na telefonie

- **iPhone:** otwórz adres w **Safari** → **Udostępnij** → **Do ekranu początkowego**.
- **Android:** otwórz adres w **Chrome** → menu **⋮** → **Zainstaluj aplikację** (albo **Dodaj do ekranu głównego**).

Uruchom STAYSI z ikony, załóż konto, potwierdź e-mail linkiem ze skrzynki i zaloguj się.

## Każda kolejna zmiana

Zmieniasz pliki → w GitHub Desktop **Commit to main** → **Push origin**. Vercel sam opublikuje nową wersję w ciągu minuty.

## Gdy coś nie działa

- **„Brak konfiguracji”** po otwarciu aplikacji: w Vercel brakuje `SUPABASE_URL` lub `SUPABASE_ANON_KEY`. Po dodaniu zmiennych kliknij **Redeploy**.
- **„Claude chwilowo nie odpowiada”**: sprawdź `ANTHROPIC_API_KEY` i czy na koncie w Console są kredyty.
- **Błąd przy logowaniu:** sprawdź krok 5 i czy e-mail został potwierdzony.
- **Projekt Supabase wstrzymany** (po tygodniu bez używania): w panelu Supabase kliknij **Restore project**.
