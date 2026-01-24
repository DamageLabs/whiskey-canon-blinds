import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent, Button } from '@/components/ui';

export function TastingGuidePage() {
  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">Tasting Protocol Guide</h1>
          <p className="text-zinc-400">
            Follow these guidelines for a proper blind whiskey tasting experience
          </p>
        </div>

        {/* Quick Reference */}
        <Card variant="elevated" className="mb-6">
          <CardHeader
            title="Quick Reference"
            description="The essential rules for hosting a blind tasting"
          />
          <CardContent>
            <ol className="space-y-3 text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-sm font-medium">1</span>
                <span><strong className="text-zinc-100">Pour</strong> 0.5-1 oz per sample</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-sm font-medium">2</span>
                <span><strong className="text-zinc-100">Nose</strong> for 30-60 seconds before tasting</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-sm font-medium">3</span>
                <span><strong className="text-zinc-100">Taste neat first</strong>, then with water</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-sm font-medium">4</span>
                <span><strong className="text-zinc-100">Wait 2-3 minutes</strong> between samples</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-sm font-medium">5</span>
                <span><strong className="text-zinc-100">Limit to 4-6 whiskeys</strong> per session (prevent palate fatigue)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-sm font-medium">6</span>
                <span><strong className="text-zinc-100">No discussion</strong> until all scores are locked</span>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Tasting Flow */}
        <Card variant="elevated" className="mb-6">
          <CardHeader
            title="Tasting Flow Per Whiskey"
            description="The structured protocol for evaluating each sample"
          />
          <CardContent>
            <div className="space-y-6">
              {/* Phase 1 */}
              <div className="border-l-2 border-amber-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">Phase 1</span>
                  <h3 className="text-lg font-semibold text-zinc-100">Introduction</h3>
                </div>
                <ul className="text-zinc-400 text-sm space-y-1">
                  <li>Display whiskey number only (identity hidden)</li>
                  <li>Show pour size recommendation</li>
                  <li>"Pour and prepare" acknowledgment</li>
                </ul>
              </div>

              {/* Phase 2 */}
              <div className="border-l-2 border-amber-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">Phase 2</span>
                  <h3 className="text-lg font-semibold text-zinc-100">Nosing Phase</h3>
                  <span className="text-zinc-500 text-sm">(60 seconds)</span>
                </div>
                <ul className="text-zinc-400 text-sm space-y-1">
                  <li>"Nose First" instruction display</li>
                  <li>60-second countdown timer</li>
                  <li>Note-taking enabled during nosing</li>
                  <li>Evaluate aroma complexity, appeal, and intensity</li>
                </ul>
              </div>

              {/* Phase 3 */}
              <div className="border-l-2 border-amber-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">Phase 3</span>
                  <h3 className="text-lg font-semibold text-zinc-100">Tasting (Neat)</h3>
                </div>
                <ul className="text-zinc-400 text-sm space-y-1">
                  <li>Taste the whiskey neat first</li>
                  <li>Note-taking area active</li>
                  <li>Evaluate flavor profile, balance, and mouthfeel</li>
                </ul>
              </div>

              {/* Phase 4 */}
              <div className="border-l-2 border-amber-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">Phase 4</span>
                  <h3 className="text-lg font-semibold text-zinc-100">Tasting (With Water)</h3>
                </div>
                <ul className="text-zinc-400 text-sm space-y-1">
                  <li>"Add a few drops of water if desired"</li>
                  <li>Note-taking continues</li>
                  <li>Observe how flavors open up or change</li>
                </ul>
              </div>

              {/* Phase 5 */}
              <div className="border-l-2 border-amber-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">Phase 5</span>
                  <h3 className="text-lg font-semibold text-zinc-100">Scoring Phase</h3>
                </div>
                <ul className="text-zinc-400 text-sm space-y-1">
                  <li>Score entry required before proceeding</li>
                  <li>Enter scores for all four categories</li>
                  <li>"Lock Score" confirmation (cannot be changed)</li>
                  <li>Optional: Guess at whiskey identity</li>
                </ul>
              </div>

              {/* Phase 6 */}
              <div className="border-l-2 border-zinc-600 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-zinc-700 text-zinc-400 rounded text-xs font-medium">Phase 6</span>
                  <h3 className="text-lg font-semibold text-zinc-100">Palate Reset</h3>
                  <span className="text-zinc-500 text-sm">(2-3 minutes)</span>
                </div>
                <ul className="text-zinc-400 text-sm space-y-1">
                  <li>2-3 minute countdown between samples</li>
                  <li>Palate cleanser: water and plain crackers</li>
                  <li>"Ready for Next" button disabled until timer completes</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scoring System */}
        <Card variant="elevated" className="mb-6">
          <CardHeader
            title="Scoring System"
            description="Weighted scoring for balanced evaluation"
          />
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left py-3 px-2 text-zinc-400 font-medium">Category</th>
                    <th className="text-center py-3 px-2 text-zinc-400 font-medium">Weight</th>
                    <th className="text-left py-3 px-2 text-zinc-400 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-800">
                    <td className="py-3 px-2 text-zinc-100 font-medium">Nose</td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-bold">25%</span>
                    </td>
                    <td className="py-3 px-2 text-zinc-400">Aroma complexity, appeal, intensity</td>
                  </tr>
                  <tr className="border-b border-zinc-800">
                    <td className="py-3 px-2 text-zinc-100 font-medium">Palate</td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-bold">35%</span>
                    </td>
                    <td className="py-3 px-2 text-zinc-400">Flavor profile, balance, mouthfeel</td>
                  </tr>
                  <tr className="border-b border-zinc-800">
                    <td className="py-3 px-2 text-zinc-100 font-medium">Finish</td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-bold">25%</span>
                    </td>
                    <td className="py-3 px-2 text-zinc-400">Length, evolution, pleasantness</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-2 text-zinc-100 font-medium">Overall</td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-bold">15%</span>
                    </td>
                    <td className="py-3 px-2 text-zinc-400">Subjective enjoyment, value consideration</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Scoring Guidelines */}
        <Card variant="elevated" className="mb-6">
          <CardHeader
            title="Scoring Guidelines"
            description="Reference for consistent scoring across sessions"
          />
          <CardContent>
            <div className="grid gap-2">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-2xl font-bold text-red-400 w-16 text-center">1-2</div>
                <div>
                  <div className="text-zinc-100 font-medium">Undrinkable</div>
                  <div className="text-zinc-500 text-sm">Major flaws, defects present</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="text-2xl font-bold text-orange-400 w-16 text-center">3-4</div>
                <div>
                  <div className="text-zinc-100 font-medium">Below Average</div>
                  <div className="text-zinc-500 text-sm">Noticeable issues, not recommended</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="text-2xl font-bold text-yellow-400 w-16 text-center">5-6</div>
                <div>
                  <div className="text-zinc-100 font-medium">Average</div>
                  <div className="text-zinc-500 text-sm">Acceptable but unremarkable</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="text-2xl font-bold text-green-400 w-16 text-center">7-8</div>
                <div>
                  <div className="text-zinc-100 font-medium">Good to Very Good</div>
                  <div className="text-zinc-500 text-sm">Enjoyable, would recommend</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="text-2xl font-bold text-amber-400 w-16 text-center">9-10</div>
                <div>
                  <div className="text-zinc-100 font-medium">Excellent to Exceptional</div>
                  <div className="text-zinc-500 text-sm">Outstanding, top tier whiskey</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anti-Anchoring Rules */}
        <Card variant="elevated" className="mb-6">
          <CardHeader
            title="Anti-Anchoring Rules"
            description="Ensuring unbiased, independent scoring"
          />
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-zinc-100 font-medium">Score Isolation</h4>
                  <p className="text-zinc-400 text-sm">Participants cannot see others' scores at any time before reveal. No real-time aggregation visible.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-zinc-100 font-medium">Score Locking</h4>
                  <p className="text-zinc-400 text-sm">Once a score is submitted, it cannot be changed. This ensures honest first impressions.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-zinc-100 font-medium">No Discussion</h4>
                  <p className="text-zinc-400 text-sm">Chat and discussion are disabled during active tasting to prevent influence.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-zinc-100 font-medium">Progression Control</h4>
                  <p className="text-zinc-400 text-sm">Moderator controls when the group advances. Participants cannot skip ahead.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips for Hosts */}
        <Card variant="elevated" className="mb-6">
          <CardHeader
            title="Tips for Hosts"
            description="Best practices for running a successful tasting"
          />
          <CardContent>
            <ul className="space-y-3 text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">&#8226;</span>
                <span>Have numbered glasses or coasters ready before participants arrive</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">&#8226;</span>
                <span>Prepare palate cleansers: still water (not sparkling) and plain crackers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">&#8226;</span>
                <span>Keep the room at a comfortable temperature; avoid strong ambient odors</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">&#8226;</span>
                <span>Pour samples away from participants to maintain anonymity</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">&#8226;</span>
                <span>Consider the proof range when selecting your flight for fair comparison</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">&#8226;</span>
                <span>Have a dedicated water dropper or pipette for adding water to whiskey</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">&#8226;</span>
                <span>Remind participants to turn off phone notifications during tasting</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="text-center py-8">
          <p className="text-zinc-400 mb-4">Ready to host your own blind tasting?</p>
          <Link to="/create">
            <Button variant="primary" size="lg">
              Create a Session
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
