# Product Requirements Document: Whiskey Canon Blinds

## Blind Whiskey Tasting Web Application

**Version:** 1.0
**Date:** January 24, 2026
**Status:** Draft

---

## 1. Executive Summary

Whiskey Canon Blinds is a multi-user web application built in React that facilitates blind whiskey tasting sessions. The application enables a moderator to organize tasting events, invite participants, guide them through a structured tasting protocol, and collect independent scores before revealing the whiskey identities.

---

## 2. Problem Statement

Blind whiskey tastings require careful coordination to maintain anonymity, ensure fair scoring, and prevent bias from influencing participants. Currently, organizers rely on paper-based systems that are prone to:
- Accidental score sharing before the reveal
- Inconsistent scoring criteria across participants
- Difficulty aggregating and comparing results
- No historical record of past tastings

---

## 3. Goals and Objectives

### Primary Goals
- Enable moderators to create and manage blind tasting sessions
- Ensure complete anonymity of whiskey identities until reveal
- Prevent score anchoring by isolating participant inputs
- Provide a structured, timed tasting protocol
- Generate comprehensive results and analytics post-reveal

### Success Metrics
- Session completion rate > 90%
- Average session setup time < 5 minutes
- Participant satisfaction score > 4.5/5
- Zero premature identity reveals due to application issues

---

## 4. User Roles

### 4.1 Moderator
The session organizer who:
- Creates tasting sessions
- Defines the flight (whiskeys to be tasted)
- Invites participants via unique links or codes
- Controls session progression (start, pause, advance, reveal)
- Maintains the master key of whiskey identities
- Views aggregated results and exports data

### 4.2 Participant
Invited tasters who:
- Join sessions via invite link or code
- Follow the guided tasting protocol
- Record independent notes and scores
- Cannot see other participants' scores until reveal
- View final results after the moderator initiates reveal

---

## 5. Feature Requirements

### 5.1 Session Management (Moderator)

#### 5.1.1 Create Session
- **Name:** Session title (e.g., "Bourbon Showdown - January 2026")
- **Theme:** Category selector with options:
  - Bourbon
  - Rye
  - Scotch (Single Malt, Blended)
  - Irish
  - Japanese
  - World Whiskey
  - Custom theme (free text)
- **Proof Range:** Optional min/max proof filter for fair comparison
- **Date/Time:** Scheduled start time
- **Flight Size:** 1-6 whiskeys (enforced limit to prevent palate fatigue)

#### 5.1.2 Define Flight
For each whiskey in the flight:
- **Display Number:** Auto-assigned (1, 2, 3, etc.)
- **Actual Identity:** Name, distillery, age, proof (hidden from participants)
- **Optional Metadata:** Price, mashbill, region
- **Pour Size Recommendation:** 0.5 oz or 1 oz indicator

#### 5.1.3 Invite Participants
- Generate unique session invite link
- Generate alphanumeric session code (6 characters)
- Set maximum participant limit (optional)
- View joined participants list
- Remove participants if needed

#### 5.1.4 Session Control
- **Start Session:** Lock participant list, begin tasting
- **Advance Whiskey:** Move all participants to next sample
- **Pause Session:** Halt timer, allow break
- **Initiate Reveal:** Lock all scores, show identities
- **End Session:** Finalize and archive results

### 5.2 Tasting Protocol (Participant)

#### 5.2.1 Join Session
- Enter via invite link (auto-join)
- Enter session code manually
- Create display name (required)
- Confirm ready status

#### 5.2.2 Tasting Flow Per Whiskey
1. **Whiskey Introduction**
   - Display whiskey number only
   - Show pour size recommendation
   - "Pour and prepare" acknowledgment

2. **Nosing Phase**
   - 60-second countdown timer
   - "Nose First" instruction display
   - Optional: Note-taking enabled during nosing

3. **Tasting Phase (Neat)**
   - Instructions to taste neat first
   - Note-taking area active

4. **Tasting Phase (With Water)**
   - Prompt: "Add a few drops of water if desired"
   - Note-taking continues

5. **Scoring Phase**
   - Score entry required before proceeding
   - Scoring categories (see 5.2.3)
   - "Lock Score" confirmation

6. **Palate Reset**
   - 2-3 minute countdown between samples
   - Palate cleanser reminder (water, plain crackers)
   - "Ready for Next" button (disabled until timer completes)

#### 5.2.3 Scoring System
Each whiskey scored on a 1-10 scale (or 1-100 for precision):

| Category | Weight | Description |
|----------|--------|-------------|
| Nose | 25% | Aroma complexity, appeal, intensity |
| Palate | 35% | Flavor profile, balance, mouthfeel |
| Finish | 25% | Length, evolution, pleasantness |
| Overall Impression | 15% | Subjective enjoyment, value consideration |

**Total Score:** Weighted average displayed

#### 5.2.4 Tasting Notes
Free-form text fields for each category:
- Nose notes
- Palate notes
- Finish notes
- General comments
- Guess at identity (optional, fun feature)

### 5.3 Anti-Anchoring Measures

#### 5.3.1 Score Isolation
- Participants cannot see others' scores at any time before reveal
- No real-time score aggregation visible
- No indication of how others rated
- Chat/discussion disabled during active tasting

#### 5.3.2 Score Locking
- Once a score is submitted for a whiskey, it cannot be changed
- Confirmation modal: "Lock your scores? This cannot be undone."
- Timestamp recorded for audit purposes

#### 5.3.3 Progression Control
- Moderator controls when group advances
- Individual participants cannot skip ahead
- Everyone must complete current whiskey before proceeding

### 5.4 Reveal Phase

#### 5.4.1 Moderator Initiates Reveal
- Confirmation: "All scores locked. Ready to reveal?"
- Option to reveal one-by-one or all at once

#### 5.4.2 Reveal Display
For each whiskey:
- Number → Actual Identity animation
- Full details: Name, distillery, age, proof, price
- Aggregate scores from all participants
- Individual participant scores (anonymized option available)
- Ranking within the flight

#### 5.4.3 Results Summary
- Overall winner (highest average score)
- Category winners (best nose, palate, finish)
- Score distribution charts
- Participant accuracy on identity guesses
- Export options: PDF, CSV

### 5.5 Session History

#### 5.5.1 Archive
- All completed sessions saved
- Searchable by date, theme, whiskeys
- Participant history preserved

#### 5.5.2 Analytics
- Personal taste profile over time
- Whiskey ratings across sessions
- Comparison of preferences among group

---

## 6. User Flows

### 6.1 Moderator Flow

```
Create Account/Login
        ↓
  Create New Session
        ↓
   Define Flight (1-6 whiskeys)
        ↓
  Generate Invite Link/Code
        ↓
   Share with Participants
        ↓
  Wait for Participants to Join
        ↓
    Start Session
        ↓
  [For each whiskey]
    → Monitor Progress
    → Advance to Next Sample
        ↓
  All Whiskeys Complete
        ↓
   Initiate Reveal
        ↓
  View/Export Results
        ↓
   End Session
```

### 6.2 Participant Flow

```
  Receive Invite Link/Code
        ↓
   Join Session
        ↓
  Enter Display Name
        ↓
  Wait for Session Start
        ↓
  [For each whiskey]
    → Receive Pour Instruction
    → Nosing Phase (60s)
    → Tasting (Neat)
    → Tasting (With Water)
    → Enter Scores & Notes
    → Lock Scores
    → Palate Reset (2-3 min)
        ↓
  All Whiskeys Complete
        ↓
  Wait for Reveal
        ↓
  View Results
```

---

## 7. Technical Requirements

### 7.1 Technology Stack
- **Frontend:** React 18+ with TypeScript
- **State Management:** Redux Toolkit or Zustand
- **Real-time Communication:** WebSockets (Socket.io or native)
- **Styling:** Tailwind CSS or Styled Components
- **Backend:** Node.js with Express (or serverless functions)
- **Database:** PostgreSQL or MongoDB
- **Authentication:** JWT-based auth, OAuth optional
- **Hosting:** Vercel, AWS, or similar

### 7.2 Real-time Requirements
- Session state synchronized across all participants
- Moderator commands propagate within 500ms
- Score submissions acknowledged in real-time
- Participant presence indicators

### 7.3 Data Security
- Whiskey identities encrypted at rest
- Scores isolated per user until reveal
- Session data accessible only to participants
- HTTPS enforced
- No client-side storage of sensitive data before reveal

### 7.4 Responsive Design
- Mobile-first approach
- Optimized for tablets (common at tasting events)
- Desktop support for moderator dashboard

---

## 8. Data Models

### 8.1 Session
```typescript
interface Session {
  id: string;
  name: string;
  theme: string;
  proofRange?: { min: number; max: number };
  scheduledAt: Date;
  status: 'draft' | 'waiting' | 'active' | 'reveal' | 'completed';
  moderatorId: string;
  currentWhiskeyIndex: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### 8.2 Whiskey (Flight Item)
```typescript
interface Whiskey {
  id: string;
  sessionId: string;
  displayNumber: number;
  name: string;           // Hidden until reveal
  distillery: string;     // Hidden until reveal
  age?: number;           // Hidden until reveal
  proof: number;          // Hidden until reveal
  price?: number;         // Hidden until reveal
  pourSize: '0.5oz' | '1oz';
}
```

### 8.3 Participant
```typescript
interface Participant {
  id: string;
  sessionId: string;
  userId?: string;        // Optional for guest participants
  displayName: string;
  joinedAt: Date;
  status: 'waiting' | 'tasting' | 'completed';
}
```

### 8.4 Score
```typescript
interface Score {
  id: string;
  sessionId: string;
  whiskeyId: string;
  participantId: string;
  nose: number;
  palate: number;
  finish: number;
  overall: number;
  totalScore: number;     // Calculated weighted average
  noseNotes?: string;
  palateNotes?: string;
  finishNotes?: string;
  generalNotes?: string;
  identityGuess?: string;
  lockedAt: Date;
}
```

---

## 9. UI/UX Considerations

### 9.1 Design Principles
- **Elegant Simplicity:** Whiskey tasting is a refined experience; UI should match
- **Dark Mode Default:** Reduces eye strain in dim tasting environments
- **Large Touch Targets:** Easy interaction while holding a glass
- **Clear Typography:** Readable notes and scores at a glance

### 9.2 Key Screens

#### Moderator
1. Dashboard (session list, create new)
2. Session Setup (flight builder)
3. Invite Management
4. Live Session Control Panel
5. Results & Analytics

#### Participant
1. Join Session
2. Waiting Room
3. Tasting Screen (per whiskey)
4. Score Entry Form
5. Palate Reset (countdown)
6. Reveal Screen
7. Final Results

### 9.3 Accessibility
- WCAG 2.1 AA compliance
- Screen reader support
- Color contrast ratios for visibility
- Keyboard navigation

---

## 10. Future Considerations (Out of Scope v1.0)

- **Whiskey Database Integration:** Auto-complete whiskey details from external DB
- **Photo Upload:** Participants can photograph pours
- **Voice Notes:** Audio recording for tasting notes
- **Social Features:** Share results to social media
- **Leaderboards:** Gamification across multiple sessions
- **Virtual Tastings:** Video integration for remote participants
- **Recommendation Engine:** Suggest whiskeys based on taste profile

---

## 11. Appendix

### A. Scoring Guidelines Reference

| Score | Descriptor |
|-------|------------|
| 1-2 | Undrinkable, major flaws |
| 3-4 | Below average, noticeable issues |
| 5-6 | Average, acceptable but unremarkable |
| 7-8 | Good to very good, enjoyable |
| 9-10 | Excellent to exceptional, outstanding |

### B. Tasting Protocol Quick Reference

1. Pour 0.5-1 oz per sample
2. Nose for 30-60 seconds before tasting
3. Taste neat first, then with water
4. Wait 2-3 minutes between samples
5. Limit to 4-6 whiskeys per session
6. No discussion until all scores locked

---

**Document Approval:**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Tech Lead | | | |
| Design Lead | | | |
