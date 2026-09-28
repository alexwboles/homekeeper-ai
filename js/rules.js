/* homekeeper-ai rule bank
 * Each rule: id, title, desc, effort, months (1-12), homeTypes,
 * needs (profile flags that must all be true), heating (allowed heating types),
 * climates, neglect (plain-language cost-of-neglect note).
 * Loadable in browser (window/globalThis) and Node (globalThis).
 */
(function (g) {
  g.HK = g.HK || {};

  var H = ['house', 'condo', 'apartment'];
  var HOUSE = ['house'];
  var ALL_CLIMATE = ['cold', 'mild', 'warm'];
  var FREEZE = ['cold', 'mild'];

  var RULES = [
    // ---------- HVAC / air ----------
    { id: 'furnace-filter', title: 'Replace furnace filter', desc: 'Slide out the old filter, note the size printed on the frame, slide in a new one with the arrow pointing toward the furnace.', effort: '10 min', months: [1,2,3,4,5,6,7,8,9,10,11,12], homeTypes: H, heating: ['forced-air','heat-pump'], climates: ALL_CLIMATE,
      neglect: 'A clogged filter strains the blower motor until it dies — a $250–$600 repair. A filter costs about $5.' },
    { id: 'ac-coils', title: 'Clean AC condenser coils', desc: 'Hose off the outdoor condenser unit (power off first), clear leaves and grass from around it.', effort: '30 min', months: [4], homeTypes: H, needs: { ac: true }, climates: ALL_CLIMATE,
      neglect: 'Dirty coils make your AC work ~30% harder. A "not cooling" service call runs $150–$400.' },
    { id: 'hvac-tuneup', title: 'Schedule professional HVAC tune-up', desc: 'Book a tech to check refrigerant, electrical connections, and heat exchanger before heating season.', effort: 'book a visit', months: [9], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Small problems become mid-winter breakdowns. Emergency heat repair: $300–$1,500, usually on the coldest night.' },
    { id: 'dryer-vent', title: 'Clean the dryer vent duct', desc: 'Disconnect the duct behind the dryer, vacuum lint from both ends, check the outside flap opens freely.', effort: '30 min', months: [3], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Lint buildup is a leading cause of house fires. A pro cleaning is only ~$100–$200 — cheap insurance.' },
    { id: 'humidifier-check', title: 'Check and clean whole-home humidifier', desc: 'Replace the pad, clean mineral buildup, set the humidistat for winter.', effort: '20 min', months: [10], homeTypes: H, heating: ['forced-air'], climates: FREEZE,
      neglect: 'Dry winter air cracks woodwork and furniture, and makes 68°F feel like 64°F.' },
    { id: 'fans-winter', title: 'Reverse ceiling fans for winter', desc: 'Flip the little switch on each fan so blades spin clockwise on low, pushing warm air down.', effort: '5 min', months: [10], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Running fans the wrong way all winter just wastes the heat you paid for.' },
    { id: 'fans-summer', title: 'Reverse ceiling fans for summer', desc: 'Flip fans to spin counterclockwise on medium — pushes cool air down so you can raise the thermostat a few degrees.', effort: '5 min', months: [5], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Free comfort you are already paying for — a fan costs pennies a day to run.' },
    { id: 'range-hood', title: 'Clean range hood filter', desc: 'Soak the metal mesh filter in hot soapy water with baking soda, scrub, dry, replace.', effort: '20 min', months: [1,4,7,10], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Grease buildup is a kitchen fire risk and slowly kills the fan\'s suction.' },

    // ---------- Safety ----------
    { id: 'smoke-test', title: 'Test smoke detectors', desc: 'Press the test button on every detector until it beeps. Note any that stay silent.', effort: '5 min', months: [1,2,3,4,5,6,7,8,9,10,11,12], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'A dead detector cannot save anyone. This test takes 30 seconds per unit.' },
    { id: 'smoke-batteries', title: 'Replace smoke detector batteries', desc: 'Swap batteries in every detector (do it with the clock change so you never forget).', effort: '15 min', months: [3], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Batteries die quietly. Replace yearly even if the test beep still works.' },
    { id: 'co-test', title: 'Test carbon monoxide detectors', desc: 'Press test on each CO detector; replace any unit older than 7 years (check the date on the back).', effort: '5 min', months: [1,2,3,4,5,6,7,8,9,10,11,12], homeTypes: H, heating: ['forced-air','boiler','radiator'], climates: ALL_CLIMATE, needs: { fuel: true },
      neglect: 'Carbon monoxide is odorless and deadly. Detectors are the only warning you get.' },
    { id: 'co-batteries', title: 'Replace CO detector batteries', desc: 'Fresh batteries in every CO detector before heating season.', effort: '10 min', months: [11], homeTypes: H, heating: ['forced-air','boiler','radiator'], climates: ALL_CLIMATE, needs: { fuel: true },
      neglect: 'Heating season is CO season. Do not go into winter on weak batteries.' },
    { id: 'extinguisher', title: 'Check fire extinguisher pressure', desc: 'Confirm the gauge needle is in the green, the pin is in place, and you can reach it without climbing over storage.', effort: '5 min', months: [1], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'An extinguisher with no pressure is a red paperweight. Replace it if the gauge is low or it is over 6 years old.' },
    { id: 'gfci', title: 'Test GFCI outlets', desc: 'Press TEST then RESET on kitchen, bath, garage, and outdoor GFCI outlets. If one will not reset, replace it.', effort: '10 min', months: [2,5,8,11], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'A failed GFCI will not protect you from shock near water. Replacement outlets cost ~$15.' },

    // ---------- Plumbing ----------
    { id: 'sink-leaks', title: 'Check under sinks for leaks', desc: 'Open every sink cabinet, feel pipes and the cabinet floor for dampness, look for stains or musty smell.', effort: '15 min', months: [1,4,7,10], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'A slow drip rots cabinets and subfloors silently. Water damage averages $500–$5,000.' },
    { id: 'water-heater-flush', title: 'Flush the water heater', desc: 'Turn off power/gas, attach a hose to the drain valve, flush sediment until water runs clear.', effort: '45 min', months: [6], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Sediment buildup kills heaters years early. A replacement runs $900–$1,800.' },
    { id: 'tpr-valve', title: 'Test water heater TPR valve', desc: 'Lift the lever on the temperature-pressure relief valve briefly — water should flow, then stop when released.', effort: '5 min', months: [6], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'A stuck TPR valve can turn a water heater into a rocket. If it drips constantly afterward, replace it (~$15).' },
    { id: 'pipe-insulation', title: 'Insulate exposed pipes', desc: 'Wrap foam sleeves on pipes in unheated areas: crawl space, garage, attic, exterior walls.', effort: '1 hour', months: [10], homeTypes: H, climates: ['cold'],
      neglect: 'One burst pipe can cause $1,000–$10,000 in water damage. Foam sleeves cost a few dollars.' },
    { id: 'disposal', title: 'Freshen the garbage disposal', desc: 'Grind a tray of ice cubes with lemon or orange peels; scrub the splash guard.', effort: '10 min', months: [2,5,8,11], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Neglected disposals jam and stink. Never put grease, coffee grounds, or fibrous veg down it.' },
    { id: 'toilet-flapper', title: 'Check toilet flappers', desc: 'Drop food coloring in the tank; if color appears in the bowl within 15 minutes without flushing, replace the flapper.', effort: '15 min', months: [7], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'A leaky flapper can waste 200 gallons a day — you pay for every drop on your water bill.' },
    { id: 'hose-bibs', title: 'Shut off and drain outdoor faucets', desc: 'Close the interior shutoff valve, open the outside faucet to drain, leave it open for winter. Disconnect all hoses.', effort: '20 min', months: [10], homeTypes: HOUSE, climates: ['cold'],
      neglect: 'A frozen hose bib bursts inside the wall. Repairs mean opening drywall: $500–$2,000.' },

    // ---------- Exterior / yard ----------
    { id: 'gutters-spring', title: 'Clean gutters (spring)', desc: 'Scoop debris, flush with a hose, confirm downspouts run clear and water flows away from the house.', effort: '2 hours', months: [4], homeTypes: HOUSE, needs: { yard: true }, climates: ALL_CLIMATE,
      neglect: 'Clogged gutters rot fascia boards and dump water at your foundation. Damage: $1,000–$5,000.' },
    { id: 'gutters-fall', title: 'Clean gutters (fall)', desc: 'After most leaves are down: scoop, flush, check hangers and seams before winter.', effort: '2 hours', months: [10], homeTypes: HOUSE, needs: { yard: true }, climates: ALL_CLIMATE,
      neglect: 'Fall leaves + winter ice = ice dams and overflowing gutters that wreck siding and foundations.' },
    { id: 'roof-inspect', title: 'Inspect the roof', desc: 'From the ground with binoculars (or a careful ladder look): missing, curled, or cracked shingles; rusted flashing; moss.', effort: '30 min', months: [5], homeTypes: HOUSE, climates: ALL_CLIMATE,
      neglect: 'One missing shingle becomes a leak, then mold, then a $8,000–$20,000 roof replacement.' },
    { id: 'grading', title: 'Check grading around foundation', desc: 'Soil should slope away from the house at least 6 inches over the first 10 feet. Add soil where it has settled.', effort: '1 hour', months: [4], homeTypes: HOUSE, needs: { yard: true }, climates: ALL_CLIMATE,
      neglect: 'Water pooling at the foundation finds its way into basements. Regrading is cheap; waterproofing is not.' },
    { id: 'deck-seal', title: 'Check deck finish (reseal every 2 years)', desc: 'Splash water on the deck — if it soaks in instead of beading, clean and reseal this season.', effort: 'half day', months: [5], homeTypes: HOUSE, needs: { yard: true, deck: true }, climates: ALL_CLIMATE,
      neglect: 'Unsealed wood rots from the inside out. Deck replacement: $5,000–$15,000.' },
    { id: 'tree-trim', title: 'Trim trees away from the house', desc: 'Cut back limbs touching or overhanging the roof and siding; remove dead branches.', effort: '1–2 hours', months: [2], homeTypes: HOUSE, needs: { yard: true }, climates: ALL_CLIMATE,
      neglect: 'Limbs grind shingles in the wind, drop debris in gutters, and give pests a bridge indoors.' },
    { id: 'sprinkler-winterize', title: 'Winterize the sprinkler system', desc: 'Shut off water to the system and blow out lines with compressed air (or hire it done — usually ~$75).', effort: 'book a visit', months: [10], homeTypes: HOUSE, needs: { yard: true, sprinkler: true }, climates: ['cold'],
      neglect: 'Frozen sprinkler lines crack underground. Spring repairs: $500–$2,000.' },
    { id: 'sprinkler-startup', title: 'Start up the sprinkler system', desc: 'Reopen valves slowly, run each zone, check for cracked heads or geysers from winter damage.', effort: '1 hour', months: [4], homeTypes: HOUSE, needs: { yard: true, sprinkler: true }, climates: ['cold'],
      neglect: 'Running a damaged zone all summer wastes water and drowns one corner of the lawn.' },
    { id: 'mower-service', title: 'Service the lawn mower', desc: 'Change oil, replace/clean air filter and spark plug, sharpen or swap the blade.', effort: '1 hour', months: [3], homeTypes: HOUSE, needs: { yard: true }, climates: ALL_CLIMATE,
      neglect: 'A neglected mower tears grass instead of cutting it, inviting disease — and dies years early.' },
    { id: 'outdoor-furniture', title: 'Store or cover outdoor furniture', desc: 'Clean, dry, and store cushions indoors; cover or shelter tables and chairs.', effort: '1 hour', months: [10], homeTypes: H, needs: { yard: true }, climates: FREEZE,
      neglect: 'One winter outside can crack frames and rot cushions. Replacement sets cost hundreds.' },
    { id: 'outdoor-lighting', title: 'Check outdoor lighting', desc: 'Walk the property at dusk: replace dead bulbs, clean motion sensors, aim lights at walkways.', effort: '30 min', months: [3,6,9,12], homeTypes: HOUSE, climates: ALL_CLIMATE,
      neglect: 'Dark walkways are a fall risk and an invitation to package thieves.' },

    // ---------- Pool ----------
    { id: 'pool-open', title: 'Open the pool', desc: 'Remove cover, reinstall plugs and ladders, shock the water, balance chemistry, start the pump.', effort: 'half day', months: [4], homeTypes: HOUSE, needs: { pool: true }, climates: ALL_CLIMATE,
      neglect: 'Opening late to a green swamp costs $300–$800 in chemicals and cleanup versus a normal opening.' },
    { id: 'pool-close', title: 'Close the pool for winter', desc: 'Balance water, lower level, blow out lines, add antifreeze, cover securely.', effort: 'half day', months: [9], homeTypes: HOUSE, needs: { pool: true }, climates: FREEZE,
      neglect: 'Freeze damage to pool pipes and equipment runs $1,000–$5,000. Closing properly is far cheaper.' },
    { id: 'pool-chemistry', title: 'Test pool water chemistry', desc: 'Test chlorine, pH, and alkalinity; adjust per your test kit. Skim and empty baskets while you are at it.', effort: '15 min', months: [5,6,7,8], homeTypes: HOUSE, needs: { pool: true }, climates: ALL_CLIMATE,
      neglect: 'Bad chemistry eats pump seals, stains liners, and turns water green in days.' },
    { id: 'pool-filter', title: 'Clean the pool filter', desc: 'Backwash or hose off cartridges; check pressure gauge against your clean baseline.', effort: '20 min', months: [5,6,7,8], homeTypes: HOUSE, needs: { pool: true }, climates: ALL_CLIMATE,
      neglect: 'A strained pump works overtime and burns out — replacement pumps run $300–$600.' },
    { id: 'pool-liner', title: 'Inspect pool liner', desc: 'Walk the pool edge: look for tears, wrinkles, or fading near the waterline. Patch small tears now.', effort: '20 min', months: [5], homeTypes: HOUSE, needs: { pool: true }, climates: ALL_CLIMATE,
      neglect: 'A small tear becomes a big leak, and leaks wash out the sand base under the liner.' },

    // ---------- Appliances ----------
    { id: 'fridge-coils', title: 'Clean refrigerator coils', desc: 'Unplug, pull the fridge out, vacuum the coils underneath or behind with a brush attachment.', effort: '20 min', months: [3,9], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Dusty coils make the compressor run hot and long. Compressor repair: $200–$500.' },
    { id: 'fridge-filter', title: 'Replace fridge water filter', desc: 'Twist out the old filter, install the new one, run a gallon through to flush carbon dust.', effort: '10 min', months: [1,7], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Old filters slow water flow and can harbor bacteria. Mark the date on the new one.' },
    { id: 'oven-clean', title: 'Deep-clean the oven', desc: 'Run self-clean (remove racks first) or use baking soda paste overnight; wipe the door seal gently.', effort: '30 min + wait', months: [2,5,8,11], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Baked-on grease smokes every time you cook and can ignite at high heat.' },
    { id: 'dishwasher-filter', title: 'Clean dishwasher filter', desc: 'Twist out the bottom filter, scrub off gunk, check the spray arms for clogged holes.', effort: '15 min', months: [3,6,9,12], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'A clogged filter leaves gritty dishes and strains the drain pump.' },
    { id: 'washer-gasket', title: 'Clean washer gasket and check hoses', desc: 'Wipe the front-loader gasket folds, leave the door ajar after loads; squeeze hoses feeling for bulges or cracks.', effort: '15 min', months: [1,4,7,10], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Moldy gaskets stink up every load. Bulging hoses are a flood waiting to happen.' },
    { id: 'washer-hoses', title: 'Replace washing machine hoses', desc: 'Swap rubber hoses for braided stainless steel lines (or confirm yours are steel and in good shape).', effort: '20 min', months: [8], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Burst washer hoses are a top cause of home flooding: $500–$5,000 in damage while you are at work.' },

    // ---------- Interior ----------
    { id: 'carpet-deep', title: 'Deep-clean carpets', desc: 'Rent a cleaner or hire a pro for high-traffic areas and under furniture.', effort: 'half day', months: [4], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Ground-in grit acts like sandpaper on carpet fibers. Deep cleaning doubles carpet life.' },
    { id: 'recaulk', title: 'Check and touch up bathroom caulk', desc: 'Look for cracked, peeling, or moldy caulk around tubs and showers; scrape and re-caulk bad spots.', effort: '1 hour', months: [6], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Failed caulk lets water behind tile where it rots walls silently: $500–$3,000.' },
    { id: 'electrical-panel', title: 'Inspect the electrical panel', desc: 'Look (do not touch internals) for scorch marks, buzzing, or breakers that feel hot. Label any mystery breakers.', effort: '15 min', months: [2], homeTypes: ['house','condo'], climates: ALL_CLIMATE,
      neglect: 'Scorching or buzzing means call an electrician now — not next month.' },
    { id: 'attic-insulation', title: 'Check attic insulation depth', desc: 'Measure depth in a few spots; top up where it is thin, especially over exterior walls.', effort: '30 min', months: [10], homeTypes: HOUSE, climates: FREEZE,
      neglect: 'Thin insulation can add 15–25% to heating bills every single winter.' },
    { id: 'attic-pests', title: 'Look for signs of pests in the attic', desc: 'Droppings, gnawed wood, nesting material, daylight through vents — call a pro if you find any.', effort: '20 min', months: [11], homeTypes: HOUSE, climates: ALL_CLIMATE,
      neglect: 'Squirrels and raccoons chew wiring (fire risk) and soil insulation. Removal + repair: $1,000–$5,000.' },
    { id: 'bath-fans', title: 'Clean bathroom exhaust fans', desc: 'Pop off covers, vacuum dust from blades and housing, confirm the fan actually moves air.', effort: '20 min', months: [5], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Dusty fans trap shower moisture in the room — hello, mold on the ceiling.' },
    { id: 'weatherstrip', title: 'Check weatherstripping on doors', desc: 'Feel for drafts around exterior doors; replace cracked stripping, adjust thresholds.', effort: '30 min', months: [10], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Drafty doors waste 10–15% of your heating and cooling energy.' },
    { id: 'garage-door', title: 'Lubricate garage door hardware', desc: 'Apply garage-door lubricant to rollers, hinges, and springs (not the tracks). Wipe excess.', effort: '20 min', months: [4,10], homeTypes: HOUSE, needs: { garage: true }, climates: ALL_CLIMATE,
      neglect: 'Dry hardware wears out springs early. A snapped spring repair: $200–$600.' },
    { id: 'garage-reverse', title: 'Test garage door auto-reverse', desc: 'Place a roll of paper towels under the door; it should reverse on contact. Test the photo-eye with your foot.', effort: '5 min', months: [4,10], homeTypes: HOUSE, needs: { garage: true }, climates: ALL_CLIMATE,
      neglect: 'A door that does not reverse can injure kids and pets. Adjust or call a pro if it fails.' },
    { id: 'chimney', title: 'Schedule chimney sweep', desc: 'Book a certified sweep before burn season; they check for creosote, blockages, and cap damage.', effort: 'book a visit', months: [9], homeTypes: HOUSE, needs: { fireplace: true }, climates: ALL_CLIMATE,
      neglect: 'Creosote buildup causes chimney fires. A sweep costs $150–$300; a chimney fire costs far more.' },
    { id: 'sump-pump', title: 'Test the sump pump', desc: 'Pour a bucket of water in the pit — the pump should kick on and drain it. Confirm the discharge line is clear outside.', effort: '15 min', months: [3,6,9,12], homeTypes: HOUSE, needs: { basement: true }, climates: ALL_CLIMATE,
      neglect: 'A dead pump discovered during a storm means a flooded basement: $5,000–$20,000.' },
    { id: 'sump-pit', title: 'Clean the sump pit', desc: 'Unplug the pump, scoop out silt and debris, make sure the float moves freely.', effort: '20 min', months: [4], homeTypes: HOUSE, needs: { basement: true }, climates: ALL_CLIMATE,
      neglect: 'Debris jams the float switch — the most common reason "working" pumps fail to start.' },
    { id: 'softener-salt', title: 'Check water softener salt', desc: 'Open the brine tank; keep salt above the water line. Break up any salt bridge with a broom handle.', effort: '5 min', months: [1,2,3,4,5,6,7,8,9,10,11,12], homeTypes: H, needs: { softener: true }, climates: ALL_CLIMATE,
      neglect: 'An empty brine tank means hard water: scale in pipes, spotty dishes, scratchy laundry.' },
    { id: 'crawlspace', title: 'Peek into the crawl space', desc: 'Flashlight check for standing water, sagging insulation, or pest signs. Note the vapor barrier condition.', effort: '20 min', months: [7], homeTypes: HOUSE, needs: { crawlspace: true }, climates: ALL_CLIMATE,
      neglect: 'Moisture under the house rots joists and feeds mold you will smell before you see.' },
    { id: 'window-seals', title: 'Check window seals', desc: 'Look for fogging between double panes (failed seal) and cracked exterior caulking around frames.', effort: '30 min', months: [10], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Failed seals leak heat all winter and the fog never clears on its own.' },
    { id: 'window-tracks', title: 'Clean window tracks', desc: 'Vacuum tracks, scrub with soapy water, spray silicone lubricant so sashes glide and lock.', effort: '1 hour', months: [4], homeTypes: H, climates: ALL_CLIMATE,
      neglect: 'Gritty tracks mean windows that will not fully close — or lock.' },
    { id: 'hardwood', title: 'Refresh hardwood floors', desc: 'Deep-clean, then apply a maintenance recoat in worn traffic lanes before finish wears to bare wood.', effort: 'half day', months: [6], homeTypes: H, needs: { hardwood: true }, climates: ALL_CLIMATE,
      neglect: 'Once wear hits bare wood, you need a full sand-and-refinish ($3–$8/sq ft) instead of a simple recoat.' },
    { id: 'ice-dams', title: 'Prevent ice dams', desc: 'Confirm attic insulation and ventilation are good; install or check heat cables in valleys that iced last year.', effort: '1 hour', months: [11], homeTypes: HOUSE, climates: ['cold'],
      neglect: 'Ice dams tear off gutters and push meltwater under shingles: $1,000–$5,000 in damage.' },
    { id: 'winterize-home', title: 'Run the winter home checklist', desc: 'One pass: hose bibs off, pipes insulated, furnace filter fresh, detectors tested, emergency kit stocked.', effort: '1 hour', months: [11], homeTypes: HOUSE, climates: ['cold'],
      neglect: 'Winter causes the five most common (and most expensive) homeowner insurance claims. This hour prevents most of them.' }
  ];

  g.HK.RULES = RULES;
})(typeof globalThis !== 'undefined' ? globalThis : this);
