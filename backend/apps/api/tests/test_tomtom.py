# from datetime import UTC, datetime
# from unittest.mock import MagicMock, patch

# from django.test import TestCase, override_settings

# from apps.api.domain.geo import RouteOdometer, calculate_segment_distances_meters
# from apps.api.exceptions import UnprocessableEntityError, UpstreamServiceError
# from apps.api.services.routing import fetch_routes
# from apps.api.services.tomtom import (
#     calculate_truck_dimensions,
#     extract_route_name,
#     fetch_tomtom_routes,
# )


# class TomTomServiceTests(TestCase):
#     def test_calculate_segment_distances_scaling(self):
#         points = [(40.0, -80.0), (40.0, -79.5), (40.0, -79.0)]
#         target_total = 100000.0  # 100 km
#         segments = calculate_segment_distances_meters(
#             points, target_total_meters=target_total
#         )
#         self.assertEqual(len(segments), 2)
#         self.assertAlmostEqual(sum(segments), target_total, places=1)

#     def test_route_odometer_validation(self):
#         import polyline

#         points = [(41.8781, -87.6298), (41.5000, -88.0000), (39.7392, -104.9903)]
#         geom = polyline.encode(points)

#         # Valid segment distances (len == 2 for 3 vertices)
#         odometer = RouteOdometer.from_polyline(
#             geom,
#             segment_distances_meters=[500000.0, 1100000.0],
#             total_distance_miles=1000.0,
#         )
#         self.assertEqual(len(odometer.points), 3)
#         self.assertEqual(len(odometer.cumulative_distances_miles), 3)
#         self.assertAlmostEqual(odometer.total_distance_miles, 1000.0)

#         # Mismatch in segment distances -> raises ValueError
#         with self.assertRaises(ValueError):
#             RouteOdometer.from_polyline(geom, segment_distances_meters=[500000.0])

#         with self.assertRaises(ValueError):
#             RouteOdometer.from_polyline(geom, segment_distances_meters=[])

#     def test_calculate_truck_dimensions(self):
#         with override_settings(
#             TRUCK_HEIGHT_MM=4114,
#             TRUCK_WIDTH_MM=2590,
#             TRUCK_LENGTH_MM=21945,
#             TRUCK_AXLE_COUNT=5,
#             TRUCK_TARE_WEIGHT_LBS=30000,
#         ):
#             height_m, width_m, length_m, gross_kg, axle_kg, axles = (
#                 calculate_truck_dimensions(35000)
#             )
#             self.assertEqual(height_m, 4.114)
#             self.assertEqual(width_m, 2.59)
#             self.assertEqual(length_m, 21.945)
#             # 65000 lbs * 0.45359237 = 29483.5 -> 29484 kg
#             self.assertEqual(gross_kg, 29484)
#             self.assertEqual(axle_kg, int(round(29484 / 5)))
#             self.assertEqual(axles, 5)

#     def test_extract_route_name(self):
#         route_with_instructions = {
#             'guidance': {
#                 'instructions': [
#                     {'roadNumber': 'I-80 W', 'street': 'Interstate 80'},
#                     {'roadNumber': 'I-76 W', 'street': 'Interstate 76'},
#                 ]
#             }
#         }
#         self.assertEqual(
#             extract_route_name(route_with_instructions, 1), 'I-80 W, I-76 W'
#         )

#         route_without_guidance = {}
#         self.assertEqual(extract_route_name(route_without_guidance, 2), 'Route 2')

#     @override_settings(TOMTOM_API_KEY='')
#     def test_fetch_tomtom_routes_missing_api_key(self):
#         with self.assertRaises(UpstreamServiceError):
#             fetch_tomtom_routes(
#                 origin={'lat': 41.8781, 'lng': -87.6298},
#                 destination={'lat': 39.7392, 'lng': -104.9903},
#                 departure_time=datetime(2026, 11, 6, 12, 0, tzinfo=UTC),
#                 load_weight_lbs=35000,
#             )

#     @override_settings(TOMTOM_API_KEY='test-key')
#     @patch('apps.api.services.tomtom.request_with_retry')
#     def test_fetch_tomtom_routes_success_three_routes(self, mock_request):
#         mock_response = MagicMock()
#         mock_response.status_code = 200
#         mock_response.json.return_value = {
#             'formatVersion': '0.0.12',
#             'routes': [
#                 {
#                     'summary': {
#                         'lengthInMeters': 1600000,
#                         'travelTimeInSeconds': 54000,
#                     },
#                     'legs': [
#                         {
#                             'points': [
#                                 {'latitude': 41.8781, 'longitude': -87.6298},
#                                 {'latitude': 40.5000, 'longitude': -95.0000},
#                                 {'latitude': 39.7392, 'longitude': -104.9903},
#                             ]
#                         }
#                     ],
#                     'guidance': {
#                         'instructions': [
#                             {'roadNumber': 'I-80 W'},
#                             {'roadNumber': 'I-76 W'},
#                         ]
#                     },
#                 },
#                 {
#                     'summary': {
#                         'lengthInMeters': 1650000,
#                         'travelTimeInSeconds': 56000,
#                     },
#                     'legs': [
#                         {
#                             'points': [
#                                 {'latitude': 41.8781, 'longitude': -87.6298},
#                                 {'latitude': 39.0000, 'longitude': -94.5000},
#                                 {'latitude': 39.7392, 'longitude': -104.9903},
#                             ]
#                         }
#                     ],
#                     'guidance': {
#                         'instructions': [
#                             {'roadNumber': 'I-70 W'},
#                         ]
#                     },
#                 },
#                 {
#                     'summary': {
#                         'lengthInMeters': 1700000,
#                         'travelTimeInSeconds': 58000,
#                     },
#                     'legs': [
#                         {
#                             'points': [
#                                 {'latitude': 41.8781, 'longitude': -87.6298},
#                                 {'latitude': 38.5000, 'longitude': -90.5000},
#                                 {'latitude': 39.7392, 'longitude': -104.9903},
#                             ]
#                         }
#                     ],
#                     'guidance': {},
#                 },
#             ],
#         }
#         mock_request.return_value = mock_response

#         res = fetch_tomtom_routes(
#             origin={'lat': 41.8781, 'lng': -87.6298},
#             destination={'lat': 39.7392, 'lng': -104.9903},
#             departure_time=datetime(2026, 11, 6, 12, 0, tzinfo=UTC),
#             load_weight_lbs=35000,
#         )

#         self.assertEqual(len(res['routes']), 3)
#         self.assertEqual(res['routes'][0]['name'], 'I-80 W, I-76 W')
#         self.assertEqual(len(res['routes'][0]['distance_annotations']), 2)
#         self.assertAlmostEqual(
#             sum(res['routes'][0]['distance_annotations']), 1600000.0, places=1
#         )
#         self.assertEqual(res['routes'][1]['name'], 'I-70 W')
#         self.assertEqual(len(res['routes'][1]['distance_annotations']), 2)
#         self.assertEqual(res['routes'][2]['name'], 'Route 3')
#         self.assertEqual(len(res['routes'][2]['distance_annotations']), 2)
#         self.assertEqual(len(res['warnings']), 0)
#         self.assertEqual(res['snapped_origin']['lat'], 41.8781)
#         self.assertEqual(res['snapped_destination']['lng'], -104.9903)

#     @override_settings(TOMTOM_API_KEY='test-key')
#     @patch('apps.api.services.tomtom.request_with_retry')
#     def test_fetch_tomtom_routes_insufficient_points_raises_error(self, mock_request):
#         mock_response = MagicMock()
#         mock_response.status_code = 200
#         mock_response.json.return_value = {
#             'routes': [
#                 {
#                     'summary': {
#                         'lengthInMeters': 10000,
#                         'travelTimeInSeconds': 500,
#                     },
#                     'legs': [
#                         {
#                             'points': [
#                                 {'latitude': 41.8781, 'longitude': -87.6298},
#                             ]
#                         }
#                     ],
#                 }
#             ]
#         }
#         mock_request.return_value = mock_response

#         with self.assertRaises(UpstreamServiceError):
#             fetch_tomtom_routes(
#                 origin={'lat': 41.8781, 'lng': -87.6298},
#                 destination={'lat': 39.7392, 'lng': -104.9903},
#                 departure_time=datetime(2026, 11, 6, 12, 0, tzinfo=UTC),
#                 load_weight_lbs=35000,
#             )

#     @override_settings(TOMTOM_API_KEY='test-key')
#     @patch('apps.api.services.tomtom.request_with_retry')
#     def test_fetch_tomtom_routes_no_route(self, mock_request):
#         mock_response = MagicMock()
#         mock_response.status_code = 200
#         mock_response.json.return_value = {
#             'detailedError': {
#                 'code': 'NO_ROUTE_FOUND',
#                 'message': 'No commercial truck route could be calculated.',
#             }
#         }
#         mock_request.return_value = mock_response

#         with self.assertRaises(UnprocessableEntityError):
#             fetch_tomtom_routes(
#                 origin={'lat': 41.8781, 'lng': -87.6298},
#                 destination={'lat': 39.7392, 'lng': -104.9903},
#                 departure_time=datetime(2026, 11, 6, 12, 0, tzinfo=UTC),
#                 load_weight_lbs=35000,
#             )

#     @override_settings(
#         ROUTING_PROVIDER='tomtom',
#         TOMTOM_API_KEY='',
#         MAPBOX_ACCESS_TOKEN='valid-mapbox-token',
#     )
#     @patch('apps.api.services.routing.fetch_mapbox_routes')
#     def test_routing_fallback_to_mapbox_when_tomtom_key_empty(self, mock_mapbox):
#         mock_mapbox.return_value = {
#             'routes': [],
#             'snapped_origin': {'lat': 40.0, 'lng': -80.0},
#             'snapped_destination': {'lat': 41.0, 'lng': -81.0},
#             'warnings': [],
#         }

#         res = fetch_routes(
#             origin={'lat': 40.0, 'lng': -80.0},
#             destination={'lat': 41.0, 'lng': -81.0},
#             departure_time=datetime(2026, 11, 6, 12, 0, tzinfo=UTC),
#             load_weight_lbs=10000,
#         )

#         mock_mapbox.assert_called_once()
#         self.assertIn('routes', res)
