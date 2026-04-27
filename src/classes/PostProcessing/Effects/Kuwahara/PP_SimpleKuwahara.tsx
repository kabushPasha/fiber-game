
import { useCallback, } from "react";

import * as THREE from "three/webgpu"
import { PostProcessingEffect, useWebGPUPostProcessing } from "../../PostProcessingContext";
import { add, array, Continue, convertToTexture, float, If, int, ivec2, Loop, screenCoordinate, screenUV, select, texture, textureLoad, textureSize, vec2, vec3, vec4 } from "three/tsl";
import { Fn } from "three/src/nodes/TSL.js";
import { gaussianBlur } from "three/examples/jsm/tsl/display/GaussianBlurNode.js";

//import { useUI } from "../../../components/UIScreenContext";
//import { FloatingPalette } from "../../../components/Palette/FloatingPalette";




export function PP_KuwaharaSimple() {
    const { scenePass } = useWebGPUPostProcessing();

    const effect = useCallback((inputNode: THREE.Node) => {
        if (!inputNode || !scenePass) return inputNode;

        const kuwaharaBlender = Fn(() => {
            // Uniforms
            const size = 5.0;
            const eccentricity = 3.0;
            const number_of_sectors = 8;
            const sharpness = 10.0;

            const input_tex = convertToTexture(inputNode);
            const texel = vec2(1.0, 1.0).div(textureSize(input_tex));
            const pixel = screenCoordinate;
            const src = texture(input_tex, screenUV)
            const out = src.toVar("KuwaBlender_result");

            const struct_tensor = computeStructureTensor(input_tex).mul(2);
            //const struct_tensor_blurred = gaussianBlur(struct_tensor);
            const struct_tensor_blurred = struct_tensor;

            const dxdx = struct_tensor_blurred.x;
            const dxdy = struct_tensor_blurred.y;
            const dydy = struct_tensor_blurred.z;


            const eigenvalue_first_term = dxdx.add(dydy).div(2.0);
            const eigenvalue_square_root_term = square(dxdx.sub(dydy)).add(square(dxdy).mul(4.0)).sqrt().div(2.0);
            const first_eigenvalue = eigenvalue_first_term.add(eigenvalue_square_root_term);
            const second_eigenvalue = eigenvalue_first_term.sub(eigenvalue_square_root_term);

            const eigenvector = vec2(first_eigenvalue.sub(dxdx), dxdy.negate());
            const eigenvector_length = eigenvector.length();
            const unit_eigenvector = select(eigenvector_length.notEqual(0.0), eigenvector.div(eigenvector_length), vec2(1.0))

            const eigenvalue_sum = first_eigenvalue.add(second_eigenvalue);
            const eigenvalue_difference = first_eigenvalue.sub(second_eigenvalue);
            const anisotropy = select(eigenvalue_sum.greaterThan(0.0), eigenvalue_difference.div(eigenvalue_sum), float(0.0))

            const radius = float(size).max(0.0);


            // If Radius is 0 we dont modify out - return the sampled value
            If(radius.notEqual(0.0), () => {

                const ellipse_width_factor = float(eccentricity).add(anisotropy).div(eccentricity);
                const ellipse_width = ellipse_width_factor.mul(radius);
                const ellipse_height = radius.div(ellipse_width_factor);

                const cosine = unit_eigenvector.x;
                const sine = unit_eigenvector.y;

                const inverse_ellipse_matrix00 = cosine.div(ellipse_width);
                const inverse_ellipse_matrix01 = sine.negate().div(ellipse_height);
                const inverse_ellipse_matrix10 = sine.div(ellipse_width);
                const inverse_ellipse_matrix11 = cosine.div(ellipse_height);

                const ellipse_major_axis = ellipse_width.mul(unit_eigenvector);
                const ellipse_minor_axis = ellipse_height.mul(unit_eigenvector.yx).mul(vec2(-1, 1));
                const _ellipse_bounds = square(ellipse_major_axis).add(square(ellipse_minor_axis)).sqrt().ceil()
                const ellipse_bounds = ivec2(int(_ellipse_bounds.x), int(_ellipse_bounds.y))

                const sector_center_overlap_parameter = float(2.0).div(radius);
                const sector_envelope_angle = ((3.0 / 2.0) * Math.PI) / number_of_sectors;
                const cross_sector_overlap_parameter = sector_center_overlap_parameter.add(Math.cos(sector_envelope_angle)).div(Math.pow(Math.sin(sector_envelope_angle), 2));

                const weighted_mean_of_squared_color_of_sectors = array('vec4', 8);
                const weighted_mean_of_color_of_sectors = array('vec4', 8);
                const sum_of_weights_of_sectors = array('float', 8);

                // The center pixel (0, 0) is exempt from the main loop below for reasons that are explained in
                // the first if statement in the loop, so we need to accumulate its color, squared color, and
                // weight separately first. Luckily, the zero coordinates of the center pixel zeros out most of
                // the complex computations below, and it can easily be shown that the weight for the center
                // pixel in all sectors is simply (1 / number_of_sectors). 

                const center_color = src;
                const center_color_squared = square(center_color);
                const center_weight = 1.0 / number_of_sectors;
                const weighted_center_color = center_color.mul(center_weight);
                const weighted_center_color_squared = center_color_squared.mul(center_weight);
                for (let i = 0; i < number_of_sectors; i++) {
                    weighted_mean_of_squared_color_of_sectors.element(int(i)).assign(weighted_center_color_squared);
                    weighted_mean_of_color_of_sectors.element(int(i)).assign(weighted_center_color);
                    sum_of_weights_of_sectors.element(int(i)).assign(center_weight);
                }


                // Loop over the window of pixels inside the bounding box of the ellipse. However, we utilize the
                // fact that ellipses are mirror symmetric along the horizontal axis, so we reduce the window to
                // only the upper two quadrants, and compute each two mirrored pixels at the same time using the
                // same weight as an optimization. 

                //for (int j = 0; j <= ellipse_bounds.y; j++) {
                //for (int i = -ellipse_bounds.x; i <= ellipse_bounds.x; i++) {

                const j = int(0).toVar("iterate_j");
                Loop(j.lessThanEqual(ellipse_bounds.y), () => {
                    const i = int(ellipse_bounds.x.negate()).toVar("iterate_i");
                    Loop(i.lessThanEqual(ellipse_bounds.x), () => {

                        //Loop({ start: int(0), end: int(ellipse_bounds.y), type: 'int', condition: '<=', name: 'j' }, ({ i: j }) => {
                        //Loop({ start: int(ellipse_bounds.x.negate()), end: int(ellipse_bounds.x), type: 'int', condition: '<=', name: 'i' }, ({ i }) => {


                        // Since we compute each two mirrored pixels at the same time, we need to also exempt the
                        // pixels whose x coordinates are negative and their y coordinates are zero, that's because
                        // those are mirrored versions of the pixels whose x coordinates are positive and their y
                        // coordinates are zero, and we don't want to compute and accumulate them twice. Moreover, we
                        // also need to exempt the center pixel with zero coordinates for the same reason, however,
                        // since the mirror of the center pixel is itself, it need to be accumulated separately,
                        // hence why we did that in the code section just before this loop.
                        If(j.equal(0).and(i.lessThanEqual(0)), () => {

                        }).Else(() => {

                            // Map the pixels of the ellipse into a unit disk, exempting any points that are not part of  the ellipse or disk. 
                            // -- Matrix Multiplication might be wrong --

                            const disk_point = vec2(
                                add(i.mul(inverse_ellipse_matrix00), j.mul(inverse_ellipse_matrix10)),
                                add(i.mul(inverse_ellipse_matrix01), j.mul(inverse_ellipse_matrix11))
                            );

                            const disk_point_length_squared = disk_point.dot(disk_point);
                            If(disk_point_length_squared.greaterThan(1.0), () => { 
                                i.addAssign(1);
                                Continue(); 
                            })

                            // While each pixel belongs to a single sector in the ellipse, we expand the definition of
                            // a sector a bit to also overlap with other sectors as illustrated in Figure 8 of the
                            // polynomial weights paper. So each pixel may contribute to multiple sectors, and thus we
                            // compute its weight in each of the 8 sectors. 
                            const sector_weights = array('float', 8);

                            // We evaluate the weighting polynomial at each of the 8 sectors by rotating the disk point
                            // by 45 degrees and evaluating the weighting polynomial at each incremental rotation. To
                            // avoid potentially expensive rotations, we utilize the fact that rotations by 90 degrees
                            // are simply swapping of the coordinates and negating the x component. We also note that
                            // since the y term of the weighting polynomial is squared, it is not affected by the sign
                            // and can be computed once for the x and once for the y coordinates. So we compute every
                            // other even-indexed 4 weights by successive 90 degree rotations as discussed. 
                            const polynomial = sector_center_overlap_parameter.sub(cross_sector_overlap_parameter.mul(square(disk_point)));
                            sector_weights.element(int(0)).assign(square(add(disk_point.y, polynomial.x).max(0.0)))
                            sector_weights.element(int(2)).assign(square(add(disk_point.x.negate(), polynomial.y).max(0.0)))
                            sector_weights.element(int(4)).assign(square(add(disk_point.y.negate(), polynomial.x).max(0.0)))
                            sector_weights.element(int(6)).assign(square(add(disk_point.x, polynomial.y).max(0.0)))

                            // Then we rotate the disk point by 45 degrees, which is a simple expression involving a
                            // constant as can be demonstrated by applying a 45 degree rotation matrix. 
                            const rotated_disk_point = vec2(disk_point.x.sub(disk_point.y), disk_point.x.add(disk_point.y)).mul(Math.SQRT1_2);

                            // Finally, we compute every other odd-index 4 weights starting from the 45 degrees rotated
                            // disk point. 
                            const rotated_polynomial = sector_center_overlap_parameter.sub(cross_sector_overlap_parameter.mul(square(rotated_disk_point)));
                            sector_weights.element(int(1)).assign(square(add(rotated_disk_point.y, rotated_polynomial.x).max(0.0)))
                            sector_weights.element(int(3)).assign(square(add(rotated_disk_point.x.negate(), rotated_polynomial.y).max(0.0)))
                            sector_weights.element(int(5)).assign(square(add(rotated_disk_point.y.negate(), rotated_polynomial.x).max(0.0)))
                            sector_weights.element(int(7)).assign(square(add(rotated_disk_point.x, rotated_polynomial.y).max(0.0)))


                            // We compute a radial Gaussian weighting component such that pixels further away from the
                            // sector center gets attenuated, and we also divide by the sum of sector weights to
                            // normalize them, since the radial weight will eventually be multiplied to the sector weight
                            // below. 
                            const sector_weights_sum = float(0.0).toVar("sector_weights_sum")
                            sector_weights_sum.addAssign(sector_weights[0])
                            sector_weights_sum.addAssign(sector_weights[1])
                            sector_weights_sum.addAssign(sector_weights[2])
                            sector_weights_sum.addAssign(sector_weights[3])
                            sector_weights_sum.addAssign(sector_weights[4])
                            sector_weights_sum.addAssign(sector_weights[5])
                            sector_weights_sum.addAssign(sector_weights[6])
                            sector_weights_sum.addAssign(sector_weights[7])

                            const radial_gaussian_weight = disk_point_length_squared.mul(-Math.PI).exp().div(sector_weights_sum);


                            // Load the color of the pixel and its mirrored pixel and compute their square. 
                            //const upper_color = texture(input_tex, screenUV.add(vec2(i, j).mul(texel)))
                            //const lower_color = texture(input_tex, screenUV.sub(vec2(i, j).mul(texel)))
                            const upper_color = textureLoad(input_tex, pixel.add(vec2(i, j)))
                            const lower_color = textureLoad(input_tex, pixel.sub(vec2(i,j)))

                            const upper_color_squared = square(upper_color);
                            const lower_color_squared = square(lower_color);

                            for (let k = 0; k < number_of_sectors; k++) {
                                const weight = sector_weights.element(int(k)).mul(radial_gaussian_weight);

                                // Accumulate the pixel to each of the sectors multiplied by the sector weight.
                                const upper_index = int(k);
                                sum_of_weights_of_sectors.element(upper_index).addAssign(weight);
                                weighted_mean_of_color_of_sectors.element(upper_index).addAssign(upper_color.mul(weight));
                                weighted_mean_of_squared_color_of_sectors.element(upper_index).addAssign(upper_color_squared.mul(weight));

                                // Accumulate the mirrored pixel to each of the sectors multiplied by the sector weight.
                                const lower_index = int((k + number_of_sectors / 2) % number_of_sectors);
                                sum_of_weights_of_sectors.element(lower_index).addAssign(weight);
                                weighted_mean_of_color_of_sectors.element(lower_index).addAssign(lower_color.mul(weight));
                                weighted_mean_of_squared_color_of_sectors.element(lower_index).addAssign(lower_color_squared.mul(weight));
                            }


                        })
                        i.addAssign(1);
                    })
                    j.addAssign(1);
                })


                
                // Compute the weighted sum of mean of sectors, such that sectors with lower standard deviation
                // gets more significant weight than sectors with higher standard deviation. 
                const sum_of_weights = float(0.0).toVar("sum_of_weights");
                const weighted_sum = vec4(0.0).toVar("weighted_sum");
                for (let i = 0; i < number_of_sectors; i++) {
                    weighted_mean_of_color_of_sectors.element(int(i)).divAssign(sum_of_weights_of_sectors.element(int(i)));
                    weighted_mean_of_squared_color_of_sectors.element(int(i)).divAssign(sum_of_weights_of_sectors.element(int(i)));

                    const color_mean = weighted_mean_of_color_of_sectors.element(int(i));
                    const squared_color_mean = weighted_mean_of_squared_color_of_sectors.element(int(i));
                    const color_variance = squared_color_mean.sub(square(color_mean)).abs();

                    const standard_deviation = color_variance.rgb.sqrt().dot(vec3(1.0));

                    // Compute the sector weight based on the weight function introduced in section "3.3.1
                    // Single-scale Filtering" of the multi-scale paper. Use a threshold of 0.02 to avoid zero
                    // division and avoid artifacts in homogeneous regions as demonstrated in the paper. 
                    const weight = float(1.0).div(standard_deviation.max(0.02).pow(sharpness));

                    sum_of_weights.addAssign(weight);
                    weighted_sum.addAssign(color_mean.mul(weight));
                }

                // Fallback to the original color if all sector weights are zero due to very high standard
                // deviation and sharpness. 
                If(sum_of_weights.equal(0), () => {
                    weighted_sum.assign(center_color)
                }).Else(() => {
                    weighted_sum.divAssign(sum_of_weights);
                })

                out.assign(weighted_sum);
                
            });


            return out;
        })

        //return kuwaharaBlender();

        const kuwaharaMulti = Fn(() => {
            let out = inputNode;
            for (let i = 0; i < 10; i++) {
                out = kuwaharaSimple(out);
            }
            return out;
        })

        return kuwaharaMulti();
    }, [scenePass]);

    PostProcessingEffect(effect);

    return null;
}


const kuwaharaSimple = Fn(([input]: [THREE.Node]) => {
    const input_tex = convertToTexture(input);
    const texel = vec2(1.0, 1.0).div(textureSize(input_tex));

    const kernel_size = 3;
    const min_variance = float(9999).toVar("min_variance")
    const src = texture(input_tex, screenUV)
    const out = src.toVar("KuwaSimple_out")

    const dirs = [
        vec2(1, 1),
        vec2(-1, 1),
        vec2(1, -1),
        vec2(-1, -1),
    ]

    for (const dir of dirs) {
        const mean = vec3(0.0).toVar("mean");
        const variance = float(0.0).toVar("variance");

        for (let i = 0; i <= kernel_size; i++) {
            for (let j = 0; j <= kernel_size; j++) {
                const val = texture(input_tex, screenUV.add(dir.mul(vec2(i, j)).mul(texel)))
                mean.addAssign(val)
                const deviation = src.sub(val)
                variance.addAssign(deviation.mul(deviation));
            }
        }
        mean.divAssign((kernel_size + 1) * (kernel_size + 1))

        If(variance.length().lessThan(min_variance), () => {
            out.assign(mean);
            min_variance.assign(variance.length());
        })
    }
    return out;
})

export const computeStructureTensor = Fn(([input]: [THREE.TextureNode]) => {

    const texel = vec2(1.0, 1.0).div(textureSize(input));

    const corner_weight = 0.182;
    const center_weight = 1.0 - 2.0 * corner_weight;

    //const GxGy = vec2(0, 0).toVar();

    const Gx = vec3(0).toVar("Gx");
    const Gy = vec3(0).toVar("Gy");

    const kernel_m: number[][] = [
        [corner_weight, 0.0, -corner_weight],
        [center_weight, 0.0, -center_weight],
        [corner_weight, 0.0, -corner_weight],
    ];


    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            const val = texture(input, screenUV.add(vec2(x, y).mul(texel)));
            //.dot(vec3(0.299, 0.587, 0.114));

            /* 
         GxGy.addAssign(vec2(
             val.mul(kernel_m[y + 1][-x + 1])
             , val.mul(kernel_m[x + 1][-y + 1])
         ))*/

            Gx.addAssign(val.mul(kernel_m[y + 1][-x + 1]))
            Gy.addAssign(val.mul(kernel_m[x + 1][-y + 1]))
        }
    }

    return vec4(Gx.dot(Gx), Gx.dot(Gy), Gy.dot(Gy), 0);
    //return vec4( GxGy.x.mul(GxGy.x) , GxGy.x.mul(GxGy.y) , GxGy.y.mul(GxGy.y),0 );


})


export const square = (x: THREE.Node) => x.mul(x);




