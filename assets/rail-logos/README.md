# 夜市マップ — rail operator logos

js/night-markets.js shows these files as the station markers and the logo row
under a station name. Put one file per operator here (SVG preferred, PNG works):

| file        | operator                        | lines              |
|-------------|---------------------------------|--------------------|
| trtc.svg    | 臺北捷運 (Taipei Metro)          | BR R G O BL        |
| ntmc.svg    | 新北捷運 (New Taipei Metro)      | Y V K LB           |
| tymc.svg    | 桃園捷運 (Taoyuan Metro, 機捷)   | A                  |
| tra.svg     | 臺灣鐵路 (台鉄)                  | TRA                |
| thsr.svg    | 台灣高鐵 (高鉄)                  | THSR               |

Each logo is drawn whole (contain) on a small white rounded square; wide logos
are fine. Under a station name they appear only where several systems meet; at
the closest zoom a station of one system shows its operator's logo as its marker. While a file is missing, the map
shows the operator's short name (北捷・新北・機捷・台鉄・高鉄) in its colour.
Check each operator's terms for using its logo before publishing.
