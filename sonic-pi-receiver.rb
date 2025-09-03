# Drum-E MIDI Receiver for Sonic Pi
# Modified from original to send MIDI to Ableton instead of playing samples

# OSC Configuration: Using port 12004 for bidirectional communication
use_osc "localhost", 12004
use_midi_defaults port: "iac_driver_bus_1", channel: 1

# Fixed MIDI mapping (ignores kit selection, always uses this mapping)
# Maps to standard Ableton drum rack layout
midi_mapping = {
  # Bottom Row
  36 => 36, # Kick -> C1
  37 => 37, # Side Stick -> C#1
  38 => 38, # Snare -> D1
  39 => 39, # Clap -> D#1
  
  # Second Row
  40 => 40, # Snare 2 -> E1
  41 => 41, # Tom Lo -> F1
  42 => 42, # Hi-hat Closed -> F#1
  43 => 43, # Tom Floor -> G1
  
  # Third Row
  44 => 44, # Hi-hat Pedal -> G#1
  45 => 45, # Tom Mid -> A1
  46 => 46, # Hi-hat Open -> A#1
  47 => 47, # Tom Mid-Hi -> B1
  
  # Top Row
  48 => 48, # Tom Hi -> C2
  49 => 49, # Crash -> C#2
  50 => 50, # Tom Highest -> D2
  51 => 51  # Ride -> D#2
}

step = []
midiNotes = []

puts "Drum-E MIDI Receiver Started"
puts "Sending MIDI to: iac_driver_bus_1, channel 1"
puts "Using port 12004 for bidirectional OSC communication"

# Receive pattern from GUI
live_loop :receivedPatternDrums do
  use_real_time
  a = sync "/osc*/wek/outputs"
  b = sync "/osc*/wek2/outputs"
  set :notes, a
  set :steps, b
  puts a
end

# Receive filler pattern from GUI
live_loop :receivedFillerDrums do
  use_real_time
  c = sync "/osc*/wek3/outputs"
  d = sync "/osc*/wek4/outputs"
  set :fillerNotes, c
  set :fillerSteps, d
end

# Receive play mode selection (0=, 1=filler, 2=both)
live_loop :playGenPatternOrFiller do
  use_real_time
  e = sync "/osc*/wek5/outputs"
  set :playGenOrFiller, e
end

# Receive kit selection (compatibility with original GUI, but needed to start)
live_loop :selectKit do
  use_real_time
  f = sync "/osc*/wek6/outputs"
  set :kit, f
  # Note: We ignore kit selection and always use fixed MIDI mapping
end

# Amplitude setting (like original)
a = 1.0

# Main playback loop - sends MIDI instead of samples (matches original structure)
live_loop :playDrumPatterns, sync: :selectKit do
  midiNotes = get[:notes] || []
  step = get[:steps] || []
  genNote = get[:fillerNotes] || []
  genStep = get[:fillerSteps] || []
  playGen = get[:playGenOrFiller]
  
  # Use fixed MIDI mapping instead of kit-based samples
  
  if playGen
    # Play original pattern
    if playGen[0] == 1 || playGen[0] == 2
      16.times do |i|
        for x in 0..midiNotes.length do
          if step[x] == i
            # Send MIDI note instead of playing sample
            midi_note = midi_mapping[midiNotes[x]] || midiNotes[x]
            midi midi_note, velocity: (100 * a).to_i
          end
        end
        # Send beat position feedback to GUI for visual sync
        puts "playGen NORMAL"
        osc "/druminfo", i, 0
        sleep 0.25
      end
    end
    
    # Play AI-generated pattern
    if playGen[0] == 0 || playGen[0] == 2
      16.times do |i|
        for x in 0..genNote.length do
          if genStep[x] == i
            # Send MIDI note for generated pattern
            midi_note = midi_mapping[genNote[x]] || genNote[x]
            midi midi_note, velocity: (100 * a).to_i
          end
        end
        # Send beat position feedback with different identifier
        puts "playGen FILLER"
        osc "/druminfo", i, 1
        sleep 0.25
      end
    end
  else
    sleep 0.25
  end
end

# MIDI panic function
define :midi_panic do
  puts "MIDI Panic - stopping all notes"
  (0..127).each do |note|
    midi_note_off note
  end
end
